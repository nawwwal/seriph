'use client';

import { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { fetchAndActivate, getRemoteConfig, getValue, isSupported, setCustomSignals } from 'firebase/remote-config';
import { app, storage } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';
import { importBatchApi } from '@/lib/imports/importBatchApi';
import type { DurableUploadDeps, DurableUploadFailure, DurableUploadPhase, DurableUploadResult, DurableUploadSource, RecoverySession, RecoverySource, RegisteredSource, SourceRegistrationInput } from '@/models/import-batch.models';
import type { WalkedFile } from '@/utils/walkDirectoryEntries';

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
  try {
    const identity = reusableRecovery ? reusableRecovery.idempotencyKey : uuid();
    let batchId: string;
    let registered: RegisteredSource[];
    if (reusableRecovery) {
      phase = 'resuming';
      registered = await deps.resume(reusableRecovery, sources.map(sourceInput));
      batchId = reusableRecovery.batchId;
    } else {
      phase = 'creating'; mutationStarted = true;
      batchId = (await deps.create({ label: 'Browser import', expectedSourceCount: sources.length, idempotencyKey: identity })).batchId;
      phase = 'registering';
      registered = (await Promise.all(chunks(sources).map((chunk) => deps.register(batchId, chunk.map(sourceInput))))).flat();
      phase = 'sealing';
      await deps.seal(batchId);
    }
    const accepted = registered.filter((source) => source.accepted);
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
type RemoteConfigDeps = { isSupported: () => Promise<boolean>; get: () => any; signal: (config: any, values: Record<string, string>) => Promise<void>; activate: (config: any) => Promise<unknown>; value: (config: any) => { asBoolean: () => boolean }; };
const remote: RemoteConfigDeps = { isSupported, get: () => getRemoteConfig(app), signal: setCustomSignals, activate: fetchAndActivate, value: (config) => getValue(config, 'durable_import_enabled') };
export async function readDurableEnabled(userId: string, deps: RemoteConfigDeps = remote) { try { if (!await deps.isSupported()) return false; const config = deps.get(); await deps.signal(config, { seriph_user_id: userId }); await deps.activate(config); return deps.value(config).asBoolean(); } catch { return false; } }
export async function uploadWithFallback(files: WalkedFile[], durable: (files: WalkedFile[]) => Promise<DurableUploadResult>, legacy: (files: WalkedFile[]) => Promise<unknown>) {
  const result = await durable(files);
  if (result.ok) return true;
  if (!result.mutationStarted) { await legacy(files); return false; }
  throw result.error instanceof Error ? result.error : new Error(`Durable upload failed during ${result.phase}`);
}

const setupFailure = (error: unknown): DurableUploadFailure => ({ ok: false, phase: 'setup', mutationStarted: false, error });

export function useDurableBatchUpload() {
  const { user } = useAuth(); const { open } = useUploads(); const [enabled, setEnabled] = useState(false); const [isUploading, setIsUploading] = useState(false); const [progressBySource, setProgressBySource] = useState<Record<string, number>>({});
  useEffect(() => { let active = true; setEnabled(false); if (user) void readDurableEnabled(user.uid).then((value) => { if (active) setEnabled(value); }); return () => { active = false; }; }, [user]);
  const upload = useCallback(async (walked: WalkedFile[]): Promise<DurableUploadResult> => {
    if (!user || !enabled || walked.length === 0) return setupFailure(new Error('Durable upload is unavailable'));
    setIsUploading(true); open(); const recovery = saved(user.uid);
    const sources = prepareDurableSources(walked, recovery);
    try {
      const token = await user.getIdToken(); const api = importBatchApi(token);
      return await runDurableUpload(sources, { ...api, resume: async (session, rows) => rows.map((row) => ({ ...row, accepted: true, storagePath: `intake/${user.uid}/${session.batchId}/${row.sourceId}/${filename(row.originalName)}` })), persist: (session) => sessionStorage.setItem(KEY, JSON.stringify(session)), clearPersisted: () => sessionStorage.removeItem(KEY), progress: (sourceId, percent) => setProgressBySource((map) => ({ ...map, [sourceId]: percent })), upload: (source, file, progress) => new Promise((resolve, reject) => { const task = uploadBytesResumable(ref(storage, source.storagePath!), file); task.on('state_changed', (snap) => progress(snap.totalBytes ? Math.round(snap.bytesTransferred / snap.totalBytes * 100) : 0), reject, () => { progress(100); resolve(); }); }) }, recovery, user.uid);
    } catch (error) { setEnabled(false); return setupFailure(error); } finally { setIsUploading(false); }
  }, [enabled, open, user]);
  return { upload, isUploading, enabled, recovery: saved(user?.uid), progressBySource };
}
