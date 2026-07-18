import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { createFirestoreImportActionStore, retryImportTarget, type RetryTarget } from '@/lib/server/imports/actionCommands';

export const runtime = 'nodejs';
const targetShape = (value: unknown): RetryTarget | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>; const kind = data.kind;
  const fields = kind === 'source' ? ['kind', 'sourceId'] : kind === 'item' ? ['kind', 'itemId'] : kind === 'family' ? ['kind', 'familyPlanId'] : kind === 'enrichment' ? ['kind', 'jobId'] : [];
  return fields.length > 0 && Object.keys(data).length === fields.length && fields.every((field) => typeof data[field] === 'string' && Boolean(data[field])) ? data as RetryTarget : null;
};
export const parseRetryBody = (value: unknown): RetryTarget | null => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 ? targetShape((value as Record<string, unknown>).target) : null;
const response = (result: Awaited<ReturnType<typeof retryImportTarget>>) => result.kind === 'conflict' ? fail(result.code === 'target_not_found' ? 'not_found' : 'conflict', result.code, result.code === 'target_not_found' ? 404 : 409) : ok(result, { status: result.kind === 'queued' ? 202 : 200 });

export async function POST(request: NextRequest, context: { params: Promise<{ batchId: string }> }) {
  const ownerId = await getUidFromRequest(request); if (!ownerId) return unauthorized();
  const idempotencyKey = request.headers.get('Idempotency-Key'); const target = parseRetryBody(await request.json().catch(() => null));
  if (!idempotencyKey || !target) return fail('bad_request', 'Idempotency-Key and target are required', 400);
  try { const { batchId } = await context.params; return response(await retryImportTarget(createFirestoreImportActionStore(getAdminDb()), { ownerId, batchId, idempotencyKey, target })); }
  catch (error) { console.error('POST import batch retry failed', error); return fail('internal_error', 'Failed to retry import target', 500); }
}
