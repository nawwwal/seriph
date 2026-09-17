import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { listMergeSuggestions } from '@/lib/server/mergeSuggestions';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();
  try {
    return ok({ suggestions: await listMergeSuggestions(getAdminDb(), uid) });
  } catch (error) {
    console.error('GET /api/v1/family-merge-suggestions failed', error);
    return fail('internal_error', 'Failed to fetch merge suggestions', 500);
  }
}
