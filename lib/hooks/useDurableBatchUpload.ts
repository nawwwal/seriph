'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { ref, uploadBytesResumable, type UploadTask } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';
import { importBatchApi } from '@/lib/imports/importBatchApi';
import { createIdempotencyKey, createImportBatchActions, publicImportActionError } from '@/lib/imports/importBatchActions';
import type { DurableUploadDeps, DurableUploadFailure, DurableUploadPhase, DurableUploadResult, DurableUploadSource, RecoverySession, RecoverySource, RegisteredSource, SourceRegistrationInput } from '@/models/import-batch.models';
import type { WalkedFile } from '@/utils/walkDirectoryEntries';
import { readDurableEnabled } from './durableRemoteConfig';
import { createSourceProgressBridge } from './durableSourceProgress';

const KEY = 'seriph:durable-import:v1'; const CHUNK = 100; const CONCURRENCY = 4;
const chunks = <T,>(items: T[]) => Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK));
const detail = (error: unknown) => error instanceof Error ? error.message : 'Storage upload failed';
const sourceInput = (source: DurableUploadSource): SourceRegistrationInput => ({ sourceId: source.sourceId, originalName: source.file.name, relativePath: source.relativePath, size: source.file.size, declaredContentType: source.file.type || undefined });
const filename = (name: string) => name.split('/').pop()!.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+$/, '') || 'source';

export async function runDurableUpload(sources: DurableUploadSource[], deps: DurableUploadDeps, recovery?: RecoverySession | null, ownerId?: string): Promise<DurableUploadResult> {
  const reusableRecovery = recovery && ownerId && recovery.ownerId === ownerId && hasExactRecoveryMatch(sources, recovery) ? recovery : null;
  const reusable = Boolean(reusableRecovery);
  let phase: DurableUploadPhase = 'setup';
  let mutationStarted = reusable;
  let acceptedIds: string[] = [];
  try {
    const identity = reusableRecovery ? reusableRecovery.idempotencyKey : uuid();
    let batchId: string;
    let registered: RegisteredSource[];
    if (reusableRecovery) {
      phase = 'resuming';
      deps.batchReady?.(reusableRecovery.batchId);
      registered = await deps.resume(reusableRecovery, sources.map(sourceInput));
      batchId = reusableRecovery.batchId;
    } else {
      phase = 'creating'; mutationStarted = true;
      batchId = (await deps.create({ label: 'Browser import', expectedSourceCount: sources.length, idempotencyKey: identity })).batchId;
      deps.batchReady?.(batchId);
      phase = 'registering';
      registered = (await Promise.all(chunks(sources).map((chunk) => deps.register(batchId, chunk.map(sourceInput))))).flat();
      phase = 'sealing';
      await deps.seal(batchId);
    }
    const accepted = registered.filter((source) => source.accepted);
    acceptedIds = accepted.map((source) => source.sourceId);
    deps.persist?.({ ownerId: ownerId ?? recovery?.ownerId ?? 'unknown', batchId, idempotencyKey: identity, sourceIds: accepted.map((source) => source.sourceId), sources: accepted.map((source) => ({ sourceId: source.sourceId, originalName: source.originalName, relativePath: source.relativePath, size: source.size })) });
    phase = 'uploading';
    let cursor = 0;
    let firstFailure: unknown = null;
    const worker = async () => { while (cursor < registered.length) {
      const source = registered[cursor++]!; const file = sources.find((item) => item.sourceId === source.sourceId)?.file;
      if (!source.accepted || !file) continue;
      try { await deps.upload(source, file, (percent) => deps.progress?.(source.sourceId, percent)); } catch (error) {
        firstFailure ??= error;
        try { await deps.fail(batchId, source.sourceId, { state: 'upload_failed', detail: detail(error) }); } catch (failureError) { firstFailure ??= failureError; }
      }
    } };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, registered.length) }, worker));
    if (firstFailure) return { ok: false, phase, mutationStarted, error: firstFailure };
    deps.clearPersisted?.();
    return { ok: true, batchId, phase: 'completed' };
  } catch (error) {
    return { ok: false, phase, mutationStarted, error };
  } finally {
    // Terminal source state belongs to the durable batch ledger; remove only the client overlay.
    acceptedIds.forEach((sourceId) => deps.clearProgress?.(sourceId));
  }
}

const saved = (ownerId?: string): RecoverySession | null => { try { const recovery = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as RecoverySession | null; return recovery?.ownerId === ownerId ? recovery : null; } catch { return null; } };
const unique = (ids: string[]) => new Set(ids).size === ids.length;
const matches = (file: Pick<WalkedFile, 'file' | 'relativePath'>, source: RecoverySource) => file.file.name === source.originalName && file.relativePath === source.relativePath && file.file.size === source.size;
const hasExactRecoveryShape = (recovery: RecoverySession, sourceCount: number) => { const persistedIds = recovery.sources.map((source) => source.sourceId); return recovery.sourceIds.length === sourceCount && recovery.sources.length === sourceCount && unique(recovery.sourceIds) && unique(persistedIds) && recovery.sourceIds.every((sourceId) => persistedIds.includes(sourceId)); };
const hasExactRecoveryMatch = (sources: DurableUploadSource[], recovery: RecoverySession) => { if (!hasExactRecoveryShape(recovery, sources.length) || !unique(sources.map((source) => source.sourceId))) return false; const byId = new Map(recovery.sources.map((source) => [source.sourceId, source])); return sources.every((source) => byId.get(source.sourceId) !== undefined && matches(source, byId.get(source.sourceId)!)); };
const freshSources = (walked: Pick<WalkedFile, 'file' | 'relativePath'>[]) => walked.map((file) => ({ file: file.file, relativePath: file.relativePath, sourceId: uuid() }));
export const prepareDurableSources = (walked: Pick<WalkedFile, 'file' | 'relativePath'>[], recovery: RecoverySession | null) => {
  if (!recovery || !hasExactRecoveryShape(recovery, walked.length)) return freshSources(walked);
  const remaining = [...recovery.sources];
  const sourceIds = walked.map((file) => {
    const index = remaining.findIndex((source) => matches(file, source));
    if (index < 0) return null;
    return remaining.splice(index, 1)[0]!.sourceId;
  });
  return sourceIds.every((sourceId): sourceId is string => sourceId !== null) && unique(sourceIds) ? walked.map((file, index) => ({ file: file.file, relativePath: file.relativePath, sourceId: sourceIds[index]! })) : freshSources(walked);
};
export function useDurableBatchUpload() {
  const { user } = useAuth(); const { setNotice, registerClientUpload, setSourceProgress } = useUploads(); const [remoteConfig, setRemoteConfig] = useState<{ ownerId: string; enabled: boolean } | null>(null); const [isUploading, setIsUploading] = useState(false); const [progressBySource, setProgressBySource] = useState<Record<string, number>>({});
  const tasks = useRef(new Set<UploadTask>()); const cancelRequested = useRef(false); const activeBatchId = useRef<string | null>(null);
  const enabled = Boolean(user) && (remoteConfig?.ownerId !== user?.uid || remoteConfig?.enabled === true);
  useEffect(() => { let active = true; if (user) void readDurableEnabled(user.uid).then((value) => { if (active) setRemoteConfig({ ownerId: user.uid, enabled: value }); }); return () => { active = false; }; }, [user]);
  const publishLocalProgress = useCallback((sourceId: string, percent: number | null) => {
    setProgressBySource((map) => { if (percent === null) { if (!(sourceId in map)) return map; const next = { ...map }; delete next[sourceId]; return next; } return { ...map, [sourceId]: percent }; });
  }, []);
  const publishProgress = useMemo(() => createSourceProgressBridge(setSourceProgress, publishLocalProgress), [publishLocalProgress, setSourceProgress]);
  const cancel = useCallback(() => {
    cancelRequested.current = true; tasks.current.forEach((task) => task.cancel());
    const batchId = activeBatchId.current;
    if (batchId && user) void createImportBatchActions(() => user.getIdToken()).cancel({ batchId, idempotencyKey: createIdempotencyKey('cancel') })
      .then(() => { sessionStorage.removeItem(KEY); activeBatchId.current = null; })
      .catch((cause) => setNotice(publicImportActionError(cause)));
  }, [setNotice, user]);
  const upload = useCallback(async (walked: WalkedFile[]): Promise<DurableUploadResult> => {
    if (!user || !enabled || walked.length === 0) return { ok: false, phase: 'setup', mutationStarted: false, error: new Error('Durable upload is unavailable') };
    cancelRequested.current = false; setNotice(null); setIsUploading(true); const unregister = registerClientUpload(cancel); const recovery = saved(user.uid);
    const sources = prepareDurableSources(walked, recovery);
    try {
      const token = await user.getIdToken(); const api = importBatchApi(token);
      const result = await runDurableUpload(sources, { ...api, batchReady: (batchId) => { activeBatchId.current = batchId; }, resume: async (session, rows) => rows.map((row) => ({ ...row, accepted: true, storagePath: `intake/${user.uid}/${session.batchId}/${row.sourceId}/${filename(row.originalName)}` })), persist: (session) => sessionStorage.setItem(KEY, JSON.stringify(session)), clearPersisted: () => sessionStorage.removeItem(KEY), progress: publishProgress, clearProgress: (sourceId) => publishProgress(sourceId, null), upload: (source, file, progress) => new Promise((resolve, reject) => { if (cancelRequested.current) { reject(new Error('Upload canceled')); return; } const task = uploadBytesResumable(ref(storage, source.storagePath!), file); tasks.current.add(task); const remove = () => tasks.current.delete(task); task.on('state_changed', (snap) => progress(snap.totalBytes ? Math.round(snap.bytesTransferred / snap.totalBytes * 100) : 0), (error) => { remove(); reject(error); }, () => { remove(); progress(100); resolve(); }); }) }, recovery, user.uid);
      if (!result.ok && !result.mutationStarted) setNotice('Import could not start. Your files were not uploaded. Try again.');
      return result;
    } catch (error) { setNotice('Import could not start. Your files were not uploaded. Try again.'); return { ok: false, phase: 'setup', mutationStarted: false, error }; } finally { unregister(); setIsUploading(false); }
  }, [cancel, enabled, publishProgress, registerClientUpload, setNotice, user]);
  return { upload, cancel, isUploading, enabled, recovery: saved(user?.uid), progressBySource };
}
