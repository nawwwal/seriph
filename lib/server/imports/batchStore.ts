import { randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

const OUTCOMES = ['active', 'succeeded', 'partial', 'needs_review', 'failed', 'canceled'] as const;
type Outcome = typeof OUTCOMES[number];
type Data = Record<string, unknown>;
export interface CreateImportBatchCommand { ownerId: string; idempotencyKey: string; label: string; expectedSourceCount: number; }
export type CreateImportBatchResult = { kind: 'created' | 'existing'; batchId: string } | { kind: 'invalid'; code: 'source_count' | 'label' } | { kind: 'conflict' };
export interface BatchListQuery { limit: number; outcome: Outcome | null; cursor: string | null; }

const user = (db: Firestore, ownerId: string) => db.collection('users').doc(ownerId);
const batches = (db: Firestore, ownerId: string) => user(db, ownerId).collection('importBatches');
const receipt = (db: Firestore, ownerId: string, key: string) => user(db, ownerId).collection('importBatchReceipts').doc(Buffer.from(key).toString('base64url'));
const cursor = (id: string) => Buffer.from(JSON.stringify({ id })).toString('base64url');
export const decodeCursor = (value: string | null) => { try { const id = JSON.parse(Buffer.from(value ?? '', 'base64url').toString()).id; return typeof id === 'string' && id && !id.includes('/') ? id : null; } catch { return null; } };
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
      return { kind: 'existing', batchId: String(data.batchId) };
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
  return { limit: Number.isFinite(raw) ? Math.min(50, Math.max(1, raw)) : 30, outcome: OUTCOMES.includes(outcome as Outcome) ? outcome as Outcome : null, cursor: decodeCursor(url.searchParams.get('cursor')) };
}

const scrub = (value: unknown): unknown => Array.isArray(value) ? value.map(scrub) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value as Data).filter(([key]) => key !== 'storagePath' && !key.toLowerCase().includes('url')).map(([key, item]) => [key, scrub(item)])) : value;
export function presentBatchDetail(batch: Data, familyPlans: Data[], reviewItems: Data[]) {
  const plans = familyPlans.slice(0, 100).map(scrub); const reviews = reviewItems.slice(0, 100).map(scrub);
  return { batch: scrub(batch), familyPlans: plans, reviewItems: reviews, familyPlansCursor: familyPlans.length > 100 ? cursor(String(familyPlans[99]?.id)) : null, reviewItemsCursor: reviewItems.length > 100 ? cursor(String(reviewItems[99]?.id)) : null };
}

export async function listImportBatches(db: Firestore, ownerId: string, query: BatchListQuery) {
  let request = batches(db, ownerId).orderBy('updatedAt', 'desc');
  if (query.outcome) request = request.where('outcome', '==', query.outcome).orderBy('updatedAt', 'desc');
  if (query.cursor) { const previous = await batches(db, ownerId).doc(query.cursor).get(); if (previous.exists) request = request.startAfter(previous); }
  const snap = await request.limit(query.limit + 1).get(); const docs = snap.docs.slice(0, query.limit);
  return { batches: docs.map((doc) => scrub({ batchId: doc.id, ...doc.data() })), nextCursor: snap.docs.length > query.limit ? cursor(docs[docs.length - 1]!.id) : null };
}

const list = (value: unknown): Data[] => Array.isArray(value) ? value.filter((item): item is Data => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
const pageAfter = (rows: Data[], value: string | null) => { const id = decodeCursor(value); const index = id ? rows.findIndex((row) => String(row.id) === id) : -1; return rows.slice(index + 1, index + 102); };
const taskState = (tasks: Map<string, Data>, familyId: string) => {
  const task = tasks.get(familyId); const status = typeof task?.status === 'string' ? task.status : 'waiting';
  return { catalogueState: status, state: status === 'failed' ? 'failed' : status === 'applied' ? 'ready' : 'processing', retryable: status === 'failed', attempts: typeof task?.attempts === 'number' ? task.attempts : 0 };
};
const familyRows = (plan: Data, tasks: Map<string, Data>, enrichmentState: unknown) => list(plan.families).map((family) => {
  const faces = list(family.faces); const familyId = String(family.familyId ?? family.id ?? '');
  const weights = [...new Set(faces.map((face) => face.weight).filter((weight): weight is number => typeof weight === 'number'))].sort((a, b) => a - b);
  const styles = faces.map((face) => face.styleName).filter((style): style is string => typeof style === 'string' && Boolean(style));
  return { id: familyId, familyPlanId: familyId, familyName: family.familyName, clean: family.clean, faces, faceCount: faces.length, styleCount: styles.length, assetCount: faces.reduce((sum, face) => sum + list(face.assets).length, 0), weights, styles, aiState: enrichmentState, ...taskState(tasks, familyId) };
});
export async function readImportBatchDetail(db: Firestore, ownerId: string, batchId: string, familyPlansCursor: string | null, reviewItemsCursor: string | null) {
  const ref = batches(db, ownerId).doc(batchId); const batch = await ref.get(); if (!batch.exists) return null;
  const batchData = batch.data() as Data; const planVersion = Number(batchData.planVersion ?? 0);
  if (!Number.isSafeInteger(planVersion) || planVersion < 1) return presentBatchDetail({ batchId, ...batchData }, [], []);
  const planRef = ref.collection('plans').doc(String(planVersion)); const [planSnapshot, taskSnapshot] = await Promise.all([planRef.get(), planRef.collection('applyTasks').get()]);
  if (!planSnapshot.exists) return presentBatchDetail({ batchId, ...batchData }, [], []);
  const tasks = new Map(taskSnapshot.docs.map((doc) => [doc.id, doc.data() as Data]));
  const plan = planSnapshot.data() as Data; const phases = batchData.phases as Data | undefined; const enrichment = phases?.enrichment as Data | undefined;
  const familyPlans = pageAfter(familyRows(plan, tasks, enrichment?.state ?? 'waiting'), familyPlansCursor);
  const reviews = list(plan.reviewItems).map((item) => ({ id: String(item.itemId ?? item.id ?? ''), ...item }));
  const reviewItems = pageAfter(reviews, reviewItemsCursor);
  return presentBatchDetail({ batchId, ...batch.data()! }, familyPlans, reviewItems);
}
