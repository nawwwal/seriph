import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { dismissMergeSuggestion } from '@/lib/server/mergeSuggestions';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ suggestionId: string }> },
) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();
  const { suggestionId } = await context.params;
  if (!suggestionId || suggestionId.includes('/')) return fail('bad_request', 'Invalid suggestion ID', 400);
  try {
    const dismissed = await dismissMergeSuggestion(getAdminDb(), uid, suggestionId);
    if (!dismissed) return fail('not_found', 'Suggestion not found', 404);
    return ok({ dismissed: true });
  } catch (error) {
    console.error('POST /api/v1/family-merge-suggestions/[suggestionId]/dismiss failed', error);
    return fail('internal_error', 'Failed to dismiss merge suggestion', 500);
  }
}
