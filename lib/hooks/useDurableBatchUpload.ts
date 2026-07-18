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

export async function runDurableUpload(sources: DurableUploadSource[], deps: DurableUploadDeps) {
  const batch = await deps.create({ label: 'Browser import', expectedSourceCount: sources.length, idempotencyKey: uuid() });
  const registered = (await Promise.all(chunks(sources).map((chunk) => deps.register(batch.batchId, chunk.map(sourceInput)))).then((groups) => groups.flat()));
  await deps.seal(batch.batchId);
  deps.persist?.({ batchId: batch.batchId, sourceIds: sources.map((source) => source.sourceId), sources: sources.map((source) => sourceInput(source)) });
  let cursor = 0;
  const worker = async () => { while (cursor < registered.length) {
    const source = registered[cursor++]!; const file = sources.find((item) => item.sourceId === source.sourceId)?.file;
    if (!source.accepted || !file) continue;
    try { await deps.upload(source, file, () => {}); } catch (error) { await deps.fail(batch.batchId, source.sourceId, { state: 'upload_failed', detail: detail(error) }); }
  } };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, registered.length) }, worker));
  return batch.batchId;
}

const saved = (): RecoverySession | null => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); } catch { return null; } };
const matches = (file: WalkedFile, source: RecoverySession['sources'][number]) => file.file.name === source.originalName && file.relativePath === source.relativePath && file.file.size === source.size;

export function useDurableBatchUpload() {
  const { user } = useAuth(); const { open, setUploadProgress } = useUploads(); const [enabled, setEnabled] = useState(false); const [isUploading, setIsUploading] = useState(false);
  useEffect(() => { let active = true; (async () => { try { if (!user || !await isSupported()) return; const config = getRemoteConfig(app); await setCustomSignals(config, { seriph_user_id: user.uid }); await fetchAndActivate(config); if (active) setEnabled(getValue(config, 'durable_import_enabled').asBoolean()); } catch { if (active) setEnabled(false); } })(); return () => { active = false; }; }, [user]);
  const upload = useCallback(async (walked: WalkedFile[]) => {
    if (!user || !enabled || walked.length === 0) return false;
    setIsUploading(true); open(); const recovery = saved();
    const sources = walked.map((file) => ({ file: file.file, relativePath: file.relativePath, sourceId: recovery?.sources.find((source) => matches(file, source))?.sourceId ?? uuid() }));
    try { const token = await user.getIdToken(); const api = importBatchApi(token); await runDurableUpload(sources, { ...api, persist: (session) => sessionStorage.setItem(KEY, JSON.stringify(session)), upload: (source, file, progress) => new Promise((resolve, reject) => { const task = uploadBytesResumable(ref(storage, source.storagePath!), file); task.on('state_changed', (snap) => { const percent = snap.totalBytes ? Math.round(snap.bytesTransferred / snap.totalBytes * 100) : 0; setUploadProgress(source.sourceId, percent); progress(percent); }, reject, () => { setUploadProgress(source.sourceId, 100); resolve(); }); }) }); return true; } finally { setIsUploading(false); }
  }, [enabled, open, setUploadProgress, user]);
  return { upload, isUploading, enabled, recovery: saved() };
}
