import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { cancelImportBatch, createFirestoreImportActionStore } from '@/lib/server/imports/actionCommands';

export const runtime = 'nodejs';
const response = (result: Awaited<ReturnType<typeof cancelImportBatch>>) => result.kind === 'conflict' ? fail(result.code === 'batch_missing' ? 'not_found' : 'conflict', result.code, result.code === 'batch_missing' ? 404 : 409) : ok(result, { status: result.kind === 'canceled' ? 202 : 200 });

export async function POST(request: NextRequest, context: { params: Promise<{ batchId: string }> }) {
  const ownerId = await getUidFromRequest(request); if (!ownerId) return unauthorized(); const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey) return fail('bad_request', 'Idempotency-Key is required', 400);
  try { const { batchId } = await context.params; return response(await cancelImportBatch(createFirestoreImportActionStore(getAdminDb()), { ownerId, batchId, idempotencyKey })); }
  catch (error) { console.error('POST import batch cancel failed', error); return fail('internal_error', 'Failed to cancel import batch', 500); }
}
