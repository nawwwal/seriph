import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { failImportSource } from '@/lib/server/imports/sourceCommands';

export const runtime = 'nodejs';
const body = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => key === 'state' || key === 'detail') && typeof (value as { state?: unknown }).state === 'string' && typeof (value as { detail?: unknown }).detail === 'string' ? value as { state: string; detail: string } : null;
export async function POST(request: NextRequest, context: { params: Promise<{ batchId: string; sourceId: string }> }) {
  const ownerId = await getUidFromRequest(request); if (!ownerId) return unauthorized();
  const input = body(await request.json().catch(() => null)); if (!input) return fail('bad_request', 'state and detail are required', 400);
  try { const { batchId, sourceId } = await context.params; const result = await failImportSource(getAdminDb(), { ownerId, id: batchId }, sourceId, input.state, input.detail); return result.kind === 'invalid_failure' ? fail('bad_request', 'Invalid failure state', 400) : result.kind === 'not_found' ? fail('not_found', 'Import source not found', 404) : ok(result); }
  catch (error) { console.error('POST import source failure failed', error); return fail('internal_error', 'Failed to record import source failure', 500); }
}
