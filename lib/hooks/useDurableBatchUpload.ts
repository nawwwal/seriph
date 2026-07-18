'use client';

import { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { fetchAndActivate, getRemoteConfig, getValue, isSupported, setCustomSignals } from 'firebase/remote-config';
import { app, storage } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';
import { importBatchApi } from '@/lib/imports/importBatchApi';
import type { DurableUploadDeps, DurableUploadSource, RecoverySession, SourceRegistrationInput } from '@/models/import-batch.models';
import type { WalkedFile } from '@/utils/walkDirectoryEntries';

const KEY = 'seriph:durable-import:v1'; const CHUNK = 100; const CONCURRENCY = 4;
const chunks = <T,>(items: T[]) => Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK));
const detail = (error: unknown) => error instanceof Error ? error.message : 'Storage upload failed';
const sourceInput = (source: DurableUploadSource): SourceRegistrationInput => ({ sourceId: source.sourceId, originalName: source.file.name, relativePath: source.relativePath, size: source.file.size, declaredContentType: source.file.type || undefined });
const filename = (name: string) => name.split('/').pop()!.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+$/, '') || 'source';

export async function runDurableUpload(sources: DurableUploadSource[], deps: DurableUploadDeps, recovery?: RecoverySession | null) {
  const reusable = recovery && recovery.sourceIds.length === sources.length && sources.every((source) => recovery.sourceIds.includes(source.sourceId));
  const identity = reusable ? recovery.idempotencyKey : uuid(); const batchId = reusable ? recovery.batchId : (await deps.create({ label: 'Browser import', expectedSourceCount: sources.length, idempotencyKey: identity })).batchId;
  const registered = reusable ? await deps.resume(recovery, sources.map(sourceInput)) : (await Promise.all(chunks(sources).map((chunk) => deps.register(batchId, chunk.map(sourceInput)))).then((groups) => groups.flat()));
  if (!reusable) await deps.seal(batchId);
  const accepted = registered.filter((source) => source.accepted); deps.persist?.({ batchId, idempotencyKey: identity, sourceIds: accepted.map((source) => source.sourceId), sources: accepted.map((source) => ({ sourceId: source.sourceId, originalName: source.originalName, relativePath: source.relativePath, size: source.size })) });
  let cursor = 0;
  const worker = async () => { while (cursor < registered.length) {
    const source = registered[cursor++]!; const file = sources.find((item) => item.sourceId === source.sourceId)?.file;
    if (!source.accepted || !file) continue;
    try { await deps.upload(source, file, (percent) => deps.progress?.(source.sourceId, percent)); } catch (error) { await deps.fail(batchId, source.sourceId, { state: 'upload_failed', detail: detail(error) }); }
  } };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, registered.length) }, worker));
  return batchId;
}

const saved = (): RecoverySession | null => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); } catch { return null; } };
const matches = (file: WalkedFile, source: RecoverySession['sources'][number]) => file.file.name === source.originalName && file.relativePath === source.relativePath && file.file.size === source.size;
export const prepareDurableSources = (walked: Pick<WalkedFile, 'file' | 'relativePath'>[], recovery: RecoverySession | null) => walked.map((file) => ({ file: file.file, relativePath: file.relativePath, sourceId: recovery?.sources.find((source) => matches(file as WalkedFile, source))?.sourceId ?? uuid() }));
type RemoteConfigDeps = { isSupported: () => Promise<boolean>; get: () => any; signal: (config: any, values: Record<string, string>) => Promise<void>; activate: (config: any) => Promise<unknown>; value: (config: any) => { asBoolean: () => boolean }; };
const remote: RemoteConfigDeps = { isSupported, get: () => getRemoteConfig(app), signal: setCustomSignals, activate: fetchAndActivate, value: (config) => getValue(config, 'durable_import_enabled') };
export async function readDurableEnabled(userId: string, deps: RemoteConfigDeps = remote) { try { if (!await deps.isSupported()) return false; const config = deps.get(); await deps.signal(config, { seriph_user_id: userId }); await deps.activate(config); return deps.value(config).asBoolean(); } catch { return false; } }
export async function uploadWithFallback(files: WalkedFile[], durable: (files: WalkedFile[]) => Promise<boolean>, legacy: (files: WalkedFile[]) => Promise<unknown>) { try { if (await durable(files)) return true; } catch {} await legacy(files); return false; }

export function useDurableBatchUpload() {
  const { user } = useAuth(); const { open } = useUploads(); const [enabled, setEnabled] = useState(false); const [isUploading, setIsUploading] = useState(false); const [progressBySource, setProgressBySource] = useState<Record<string, number>>({});
  useEffect(() => { let active = true; setEnabled(false); if (user) void readDurableEnabled(user.uid).then((value) => { if (active) setEnabled(value); }); return () => { active = false; }; }, [user]);
  const upload = useCallback(async (walked: WalkedFile[]) => {
    if (!user || !enabled || walked.length === 0) return false;
    setIsUploading(true); open(); const recovery = saved();
    const sources = prepareDurableSources(walked, recovery);
    try { const token = await user.getIdToken(); const api = importBatchApi(token); await runDurableUpload(sources, { ...api, resume: async (session, rows) => rows.map((row) => ({ ...row, accepted: true, storagePath: `intake/${user.uid}/${session.batchId}/${row.sourceId}/${filename(row.originalName)}` })), persist: (session) => sessionStorage.setItem(KEY, JSON.stringify(session)), progress: (sourceId, percent) => setProgressBySource((map) => ({ ...map, [sourceId]: percent })), upload: (source, file, progress) => new Promise((resolve, reject) => { const task = uploadBytesResumable(ref(storage, source.storagePath!), file); task.on('state_changed', (snap) => progress(snap.totalBytes ? Math.round(snap.bytesTransferred / snap.totalBytes * 100) : 0), reject, () => { progress(100); resolve(); }); }) }, recovery); return true; } catch { setEnabled(false); return false; } finally { setIsUploading(false); }
  }, [enabled, open, user]);
  return { upload, isUploading, enabled, recovery: saved(), progressBySource };
}
