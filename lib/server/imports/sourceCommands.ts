import { createHash } from 'node:crypto';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

type Data = Record<string, unknown>; type Batch = { ownerId: string; id: string };
export interface RegisterSourceInput { sourceId: string; originalName: string; relativePath: string; size: number; declaredContentType?: string; }
export interface RegisteredSourceResult { sourceId: string; accepted: boolean; storagePath?: string; state: 'uploading' | 'failed'; errorCode?: string; }
type RegisterResult = { kind: 'registered'; sources: RegisteredSourceResult[] } | { kind: 'batch_missing' } | { kind: 'batch_sealed' };
type Row = { index: number; occurrence: number; input: RegisterSourceInput; error: string | null; normalizedPath: string };
const MIB_512 = 512 * 1024 * 1024; const CHUNK_SIZE = 200;
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const batchRef = (db: Firestore, batch: Batch) => db.collection('users').doc(batch.ownerId).collection('importBatches').doc(batch.id);
const sourceRef = (db: Firestore, batch: Batch, sourceId: string) => batchRef(db, batch).collection('sources').doc(sourceId);
const normalize = (path: string) => path.replace(/\\/g, '/');
const rejectionRef = (db: Firestore, batch: Batch, row: Row) => batchRef(db, batch).collection('sourceRejections').doc(`rejected-${createHash('sha256').update(JSON.stringify({ sourceId: row.input.sourceId, originalName: normalize(row.input.originalName), relativePath: row.normalizedPath, size: row.input.size, declaredContentType: row.input.declaredContentType ?? null, duplicateOccurrence: row.occurrence })).digest('base64url')}`);
const invalidPath = (path: string) => !path || /^(?:[\\/]|[A-Za-z]:[\\/])/.test(path) || normalize(path).split('/').some((part) => part === '.' || part === '..');
const filename = (name: string) => normalize(name).split('/').pop()!.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+$/, '') || 'source';
const present = (source: Data): RegisteredSourceResult => source.state === 'uploading' ? { sourceId: String(source.sourceId), accepted: true, state: 'uploading', storagePath: String(source.storagePath) } : { sourceId: String(source.sourceId), accepted: false, state: 'failed', errorCode: String(source.errorCode) };
const chunks = <T>(rows: T[]) => Array.from({ length: Math.ceil(rows.length / CHUNK_SIZE) }, (_, index) => rows.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));

export async function registerImportSources(db: Firestore, batch: Batch, inputs: RegisterSourceInput[]): Promise<RegisterResult> {
  const occurrences = new Map<string, number>(); const rows: Row[] = inputs.map((input, index) => {
    const normalizedPath = normalize(input.relativePath); const occurrence = occurrences.get(input.sourceId) ?? 0; occurrences.set(input.sourceId, occurrence + 1); const duplicate = uuid(input.sourceId) && occurrence > 0;
    const error = index >= CHUNK_SIZE ? 'request_source_limit' : !uuid(input.sourceId) ? 'invalid_source_id' : duplicate ? 'duplicate_source_id' : !Number.isSafeInteger(input.size) || input.size < 0 ? 'invalid_size' : input.size > MIB_512 ? 'source_too_large' : invalidPath(input.relativePath) ? 'invalid_path' : null;
    return { index, occurrence, input, error, normalizedPath };
  });
  const results: RegisteredSourceResult[] = [];
  // Each transaction writes at most 200 source inventory documents; over-cap entries remain terminal inventory.
  for (const group of chunks(rows)) {
    const outcome = await db.runTransaction(async (tx) => {
      const batchSnap = await tx.get(batchRef(db, batch)); if (!batchSnap.exists) return null; if (batchSnap.data()!.sealed) return 'batch_sealed' as const;
      const refs = group.map((row) => row.error === 'invalid_source_id' || row.error === 'duplicate_source_id' ? rejectionRef(db, batch, row) : sourceRef(db, batch, row.input.sourceId)); const existing = await Promise.all(refs.map((ref) => tx.get(ref))); const now = FieldValue.serverTimestamp(); const eventAt = Timestamp.now(); let added = 0; let failures = 0;
      const registered = group.map((row, index) => {
        const prior = existing[index]!; if (prior.exists) return present(prior.data()!);
        const { input, error, normalizedPath } = row; const base = { sourceId: input.sourceId, ownerId: batch.ownerId, batchId: batch.id, originalName: input.originalName, relativePath: input.relativePath, normalizedRelativePath: normalizedPath, declaredSize: input.size, declaredContentType: input.declaredContentType ?? null, createdAt: now, updatedAt: now };
        const storagePath = `intake/${batch.ownerId}/${batch.id}/${input.sourceId}/${filename(input.originalName)}`; const stored = error ? { ...base, state: 'failed', errorCode: error, events: [{ type: 'registered', at: eventAt }, { type: 'failed', at: eventAt }] } : { ...base, filename: filename(input.originalName), storagePath, state: 'uploading', events: [{ type: 'registered', at: eventAt }] };
        tx.set(refs[index]!, stored); if (error !== 'invalid_source_id' && error !== 'duplicate_source_id') { added++; if (error) failures++; }
        return error ? { sourceId: input.sourceId, accepted: false, state: 'failed' as const, errorCode: error } : { sourceId: input.sourceId, accepted: true, state: 'uploading' as const, storagePath };
      });
      if (added) { const counters = batchSnap.data()!.counters as Data; tx.update(batchRef(db, batch), { counters: { ...counters, sources: Number(counters.sources ?? 0) + added, failures: Number(counters.failures ?? 0) + failures }, updatedAt: now }); }
      return registered;
    });
    if (!outcome) return { kind: 'batch_missing' }; if (outcome === 'batch_sealed') return { kind: 'batch_sealed' }; results.push(...outcome);
  }
  return { kind: 'registered', sources: results };
}

export async function sealImportBatch(db: Firestore, batch: Batch) {
  return db.runTransaction(async (tx) => { const ref = batchRef(db, batch); const snap = await tx.get(ref); if (!snap.exists) return { kind: 'batch_missing' as const }; const data = snap.data()!; if (data.sealed) return { kind: 'existing' as const }; const expected = Number(data.expectedSourceCount); const registered = Number((data.counters as Data).sources ?? 0); if (expected !== registered) return { kind: 'count_mismatch' as const, expected, registered }; tx.update(ref, { sealed: true, sealedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); return { kind: 'sealed' as const }; });
}

export async function failImportSource(db: Firestore, batch: Batch, sourceId: string, state: string, detail: string) {
  if (state !== 'upload_failed' && state !== 'canceled') return { kind: 'invalid_failure' as const }; if (!uuid(sourceId)) return { kind: 'invalid_source_id' as const };
  return db.runTransaction(async (tx) => { const batchDoc = batchRef(db, batch); const source = sourceRef(db, batch, sourceId); const [batchSnap, sourceSnap] = await Promise.all([tx.get(batchDoc), tx.get(source)]); if (!batchSnap.exists || !sourceSnap.exists) return { kind: 'not_found' as const }; if (sourceSnap.data()!.state === 'failed' || sourceSnap.data()!.state === 'canceled') return { kind: 'existing' as const }; const now = FieldValue.serverTimestamp(); const next = state === 'canceled' ? 'canceled' : 'failed'; const counters = batchSnap.data()!.counters as Data; tx.update(source, { state: next, clientFailureDetail: detail.slice(0, 2000), failureCode: state, updatedAt: now }); tx.update(batchDoc, { counters: { ...counters, failures: Number(counters.failures ?? 0) + (next === 'failed' ? 1 : 0) }, reconciliation: { state: 'scheduled', requestedAt: now }, updatedAt: now }); return { kind: 'failed' as const }; });
}
