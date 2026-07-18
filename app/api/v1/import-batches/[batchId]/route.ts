import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { readImportBatchDetail } from '@/lib/server/imports/batchStore';

export const runtime = 'nodejs';
export async function GET(request: NextRequest, context: { params: Promise<{ batchId: string }> }) {
  const ownerId = await getUidFromRequest(request); if (!ownerId) return unauthorized();
  try {
    const { batchId } = await context.params;
    const detail = await readImportBatchDetail(getAdminDb(), ownerId, batchId, request.nextUrl.searchParams.get('familyPlansCursor'), request.nextUrl.searchParams.get('reviewItemsCursor'));
    return detail ? ok(detail) : fail('not_found', 'Import batch not found', 404);
  } catch (error) { console.error('GET /api/v1/import-batches/[batchId] failed', error); return fail('internal_error', 'Failed to fetch import batch', 500); }
}
