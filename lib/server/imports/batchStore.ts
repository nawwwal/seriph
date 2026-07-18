import { randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

const OUTCOMES = ['active', 'succeeded', 'partial', 'needs_review', 'failed', 'canceled'] as const;
type Outcome = typeof OUTCOMES[number];
type Data = Record<string, unknown>;
export interface CreateImportBatchCommand { ownerId: string; idempotencyKey: string; label: string; expectedSourceCount: number; }
export type CreateImportBatchResult = { kind: 'created'; batchId: string } | { kind: 'invalid'; code: 'source_count' | 'label' } | { kind: 'conflict' };
export interface BatchListQuery { limit: number; outcome: Outcome | null; }

const user = (db: Firestore, ownerId: string) => db.collection('users').doc(ownerId);
const batches = (db: Firestore, ownerId: string) => user(db, ownerId).collection('importBatches');
const receipt = (db: Firestore, ownerId: string, key: string) => user(db, ownerId).collection('importBatchReceipts').doc(Buffer.from(key).toString('base64url'));
const cursor = (id: string) => Buffer.from(JSON.stringify({ id })).toString('base64url');
const after = (value: string | null) => { try { return JSON.parse(Buffer.from(value ?? '', 'base64url').toString()).id as string; } catch { return null; } };
const counters = () => ({ sources: 0, discoveredItems: 0, fonts: 0, families: 0, duplicates: 0, review: 0, warnings: 0, failures: 0 });
const valid = (command: CreateImportBatchCommand): CreateImportBatchResult | null => {
  if (!command.label.trim()) return { kind: 'invalid', code: 'label' };
  return Number.isInteger(command.expectedSourceCount) && command.expectedSourceCount >= 0 ? null : { kind: 'invalid', code: 'source_count' };
};

export async function createImportBatch(db: Firestore, command: CreateImportBatchCommand): Promise<CreateImportBatchResult> {
  const invalid = valid(command); if (invalid) return invalid;
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(receipt(db, command.ownerId, command.idempotencyKey));
    if (existing.exists) {
      const data = existing.data() as Data;
      if (data.label !== command.label || data.expectedSourceCount !== command.expectedSourceCount) return { kind: 'conflict' };
      return { kind: 'created', batchId: String(data.batchId) };
    }
    const batchId = randomUUID(); const now = FieldValue.serverTimestamp(); const ref = batches(db, command.ownerId).doc(batchId);
    tx.set(ref, { batchId, ownerId: command.ownerId, label: command.label, expectedSourceCount: command.expectedSourceCount, schemaVersion: 1, sealed: false, planVersion: 0, outcome: 'active', counters: counters(), createdAt: now, updatedAt: now, phases: { upload: { state: 'registered', attempts: 0, updatedAt: now }, planning: { state: 'building', attempts: 0, updatedAt: now }, enrichment: { state: 'blocked', attempts: 0, updatedAt: now } } });
    tx.set(receipt(db, command.ownerId, command.idempotencyKey), { batchId, label: command.label, expectedSourceCount: command.expectedSourceCount, createdAt: now });
    return { kind: 'created', batchId };
  });
}

export function parseBatchListQuery(url: URL): BatchListQuery {
  const raw = Number.parseInt(url.searchParams.get('limit') ?? '30', 10);
  const outcome = url.searchParams.get('outcome');
  return { limit: Number.isFinite(raw) ? Math.min(50, Math.max(1, raw)) : 30, outcome: OUTCOMES.includes(outcome as Outcome) ? outcome as Outcome : null };
}

const scrub = (value: unknown): unknown => Array.isArray(value) ? value.map(scrub) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value as Data).filter(([key]) => key !== 'storagePath' && !key.toLowerCase().includes('url')).map(([key, item]) => [key, scrub(item)])) : value;
export function presentBatchDetail(batch: Data, familyPlans: Data[], reviewItems: Data[]) {
  const plans = familyPlans.slice(0, 100).map(scrub); const reviews = reviewItems.slice(0, 100).map(scrub);
  return { batch: scrub(batch), familyPlans: plans, reviewItems: reviews, familyPlansCursor: familyPlans.length > 100 ? cursor(String(familyPlans[100]?.id)) : null, reviewItemsCursor: reviewItems.length > 100 ? cursor(String(reviewItems[100]?.id)) : null };
}

export async function listImportBatches(db: Firestore, ownerId: string, query: BatchListQuery) {
  let request = batches(db, ownerId).orderBy('updatedAt', 'desc');
  if (query.outcome) request = request.where('outcome', '==', query.outcome).orderBy('updatedAt', 'desc');
  const snap = await request.limit(query.limit).get();
  return { batches: snap.docs.map((doc) => scrub({ batchId: doc.id, ...doc.data() })) };
}

async function children(ref: ReturnType<typeof batches> extends infer T ? T extends { doc(id: string): infer R } ? R : never : never, name: string, value: string | null) {
  let request = (ref as unknown as { collection: (name: string) => any }).collection(name).orderBy('__name__'); const id = after(value); if (id) request = request.startAfter(id);
  const snap = await request.limit(101).get(); return snap.docs.map((doc: { id: string; data: () => Data }) => ({ id: doc.id, ...doc.data() }));
}
export async function readImportBatchDetail(db: Firestore, ownerId: string, batchId: string, familyPlansCursor: string | null, reviewItemsCursor: string | null) {
  const ref = batches(db, ownerId).doc(batchId); const batch = await ref.get(); if (!batch.exists) return null;
  const [familyPlans, reviewItems] = await Promise.all([children(ref, 'familyPlans', familyPlansCursor), children(ref, 'reviewItems', reviewItemsCursor)]);
  return presentBatchDetail({ batchId, ...batch.data()! }, familyPlans, reviewItems);
}
