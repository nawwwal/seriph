import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { createImportBatch, listImportBatches, parseBatchListQuery } from '@/lib/server/imports/batchStore';

export const runtime = 'nodejs';
const body = (value: unknown) => {
  const data = value as Record<string, unknown>;
  return typeof data?.label === 'string' && typeof data.expectedSourceCount === 'number' ? data : null;
};

export async function POST(request: NextRequest) {
  const ownerId = await getUidFromRequest(request); if (!ownerId) return unauthorized();
  const idempotencyKey = request.headers.get('Idempotency-Key'); const data = body(await request.json().catch(() => null));
  if (!idempotencyKey || !data) return fail('bad_request', 'Idempotency-Key, label, and expectedSourceCount are required', 400);
  try {
    const result = await createImportBatch(getAdminDb(), { ownerId, idempotencyKey, label: data.label as string, expectedSourceCount: data.expectedSourceCount as number });
    if (result.kind === 'conflict') return fail('conflict', 'Idempotency-Key was used with a different command', 409);
    if (result.kind === 'invalid') return fail('bad_request', `Invalid ${result.code}`, 400);
    return ok({ batchId: result.batchId }, { status: 201 });
  } catch (error) { console.error('POST /api/v1/import-batches failed', error); return fail('internal_error', 'Failed to create import batch', 500); }
}

export async function GET(request: NextRequest) {
  const ownerId = await getUidFromRequest(request); if (!ownerId) return unauthorized();
  try { return ok(await listImportBatches(getAdminDb(), ownerId, parseBatchListQuery(request.nextUrl))); }
  catch (error) { console.error('GET /api/v1/import-batches failed', error); return fail('internal_error', 'Failed to fetch import batches', 500); }
}
