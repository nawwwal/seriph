import { FieldValue, type Firestore } from 'firebase-admin/firestore';

type Data = Record<string, unknown>;
type Batch = { ownerId: string; id: string };
export interface RegisterSourceInput { sourceId: string; originalName: string; relativePath: string; size: number; declaredContentType?: string; }
export interface RegisteredSourceResult { sourceId: string; accepted: boolean; storagePath?: string; state: 'uploading' | 'failed'; errorCode?: string; }
type RegisterResult = { kind: 'registered'; sources: RegisteredSourceResult[] } | { kind: 'batch_missing' } | { kind: 'source_conflict' };
const MIB_512 = 512 * 1024 * 1024;
const batchRef = (db: Firestore, batch: Batch) => db.collection('users').doc(batch.ownerId).collection('importBatches').doc(batch.id);
const sourceRef = (db: Firestore, batch: Batch, sourceId: string) => batchRef(db, batch).collection('sources').doc(sourceId);
const normalized = (path: string) => path.replace(/\\/g, '/');
const safePath = (path: string) => {
  const value = normalized(path); if (!value || /^[\\/]/.test(path) || value.split('/').some((part) => part === '.' || part === '..')) return null;
  return value;
};
const filename = (name: string) => {
  const value = normalized(name).split('/').pop()!.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+$/, '');
  return value || 'source';
};
const errorFor = (source: RegisterSourceInput, index: number) => index >= 200 ? 'request_source_limit' : !Number.isSafeInteger(source.size) || source.size < 0 ? 'invalid_size' : source.size > MIB_512 ? 'source_too_large' : !safePath(source.relativePath) ? 'invalid_path' : null;
const result = (source: Data): RegisteredSourceResult => source.state === 'uploading' ? { sourceId: String(source.sourceId), accepted: true, state: 'uploading', storagePath: String(source.storagePath) } : { sourceId: String(source.sourceId), accepted: false, state: 'failed', errorCode: String(source.errorCode) };

export async function registerImportSources(db: Firestore, batch: Batch, inputs: RegisterSourceInput[]): Promise<RegisterResult> {
  return db.runTransaction(async (tx) => {
    const batchSnap = await tx.get(batchRef(db, batch)); const refs = inputs.map((input) => sourceRef(db, batch, input.sourceId)); const existing = await Promise.all(refs.map((ref) => tx.get(ref)));
    if (!batchSnap.exists) return { kind: 'batch_missing' } as RegisterResult;
    const rows = inputs.map((input, index) => ({ input, ref: refs[index]!, error: errorFor(input, index), path: safePath(input.relativePath), existing: existing[index]! }));
    if (rows.some(({ existing: snap, input }) => snap.exists && snap.data()!.sourceId !== input.sourceId)) return { kind: 'source_conflict' };
    const now = FieldValue.serverTimestamp(); let added = 0;
    for (const { input, ref, error, path, existing: snap } of rows) {
      if (snap.exists) continue;
      const base = { sourceId: input.sourceId, ownerId: batch.ownerId, batchId: batch.id, originalName: input.originalName, relativePath: input.relativePath, normalizedRelativePath: path, declaredSize: input.size, declaredContentType: input.declaredContentType ?? null, createdAt: now, updatedAt: now };
      const stored = error ? { ...base, state: 'failed', errorCode: error, events: [{ type: 'registered', at: now }, { type: 'failed', at: now }] } : { ...base, filename: filename(input.originalName), storagePath: `intake/${batch.ownerId}/${batch.id}/${input.sourceId}/${filename(input.originalName)}`, state: 'uploading', events: [{ type: 'registered', at: now }] };
      tx.set(ref, stored); added++;
    }
    if (added) { const counters = batchSnap.data()!.counters as Data; tx.update(batchRef(db, batch), { counters: { ...counters, sources: Number(counters.sources ?? 0) + added, failures: Number(counters.failures ?? 0) + rows.filter((row) => !row.existing.exists && row.error).length }, updatedAt: now }); }
    return { kind: 'registered', sources: rows.map(({ input, error, existing: snap }) => snap.exists ? result(snap.data()!) : error ? { sourceId: input.sourceId, accepted: false, state: 'failed', errorCode: error } : { sourceId: input.sourceId, accepted: true, state: 'uploading', storagePath: `intake/${batch.ownerId}/${batch.id}/${input.sourceId}/${filename(input.originalName)}` }) } as RegisterResult;
  });
}

export async function sealImportBatch(db: Firestore, batch: Batch) {
  return db.runTransaction(async (tx) => { const ref = batchRef(db, batch); const snap = await tx.get(ref); if (!snap.exists) return { kind: 'batch_missing' as const }; const data = snap.data()!; if (data.sealed) return { kind: 'existing' as const }; const expected = Number(data.expectedSourceCount); const registered = Number((data.counters as Data).sources ?? 0); if (expected !== registered) return { kind: 'count_mismatch' as const, expected, registered }; tx.update(ref, { sealed: true, sealedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); return { kind: 'sealed' as const }; });
}

export async function failImportSource(db: Firestore, batch: Batch, sourceId: string, state: string, detail: string) {
  if (state !== 'upload_failed' && state !== 'canceled') return { kind: 'invalid_failure' as const };
  return db.runTransaction(async (tx) => { const batchDoc = batchRef(db, batch); const source = sourceRef(db, batch, sourceId); const [batchSnap, sourceSnap] = await Promise.all([tx.get(batchDoc), tx.get(source)]); if (!batchSnap.exists || !sourceSnap.exists) return { kind: 'not_found' as const }; if (sourceSnap.data()!.state === 'failed' || sourceSnap.data()!.state === 'canceled') return { kind: 'existing' as const }; const now = FieldValue.serverTimestamp(); const next = state === 'canceled' ? 'canceled' : 'failed'; const counters = batchSnap.data()!.counters as Data; tx.update(source, { state: next, clientFailureDetail: detail.slice(0, 2000), failureCode: state, updatedAt: now }); tx.update(batchDoc, { counters: { ...counters, failures: Number(counters.failures ?? 0) + (next === 'failed' ? 1 : 0) }, reconciliation: { state: 'scheduled', requestedAt: now }, updatedAt: now }); return { kind: 'failed' as const }; });
}
