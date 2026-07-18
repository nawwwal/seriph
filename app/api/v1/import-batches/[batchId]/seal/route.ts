import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { sealImportBatch } from '@/lib/server/imports/sourceCommands';

export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: { params: Promise<{ batchId: string }> }) {
  const ownerId = await getUidFromRequest(request); if (!ownerId) return unauthorized();
  try { const { batchId } = await context.params; const result = await sealImportBatch(getAdminDb(), { ownerId, id: batchId }); return result.kind === 'batch_missing' ? fail('not_found', 'Import batch not found', 404) : result.kind === 'count_mismatch' ? fail('conflict', 'Registered source count does not match batch', 409, result) : ok(result); }
  catch (error) { console.error('POST import batch seal failed', error); return fail('internal_error', 'Failed to seal import batch', 500); }
}
