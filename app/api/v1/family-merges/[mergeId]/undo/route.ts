import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { undoFamilyMerge } from '@/lib/server/familyMutations';
import { statusForMutation } from '@/lib/server/familyMutationStore';
import { clearShelfStatsCache } from '@/lib/server/catalogFamilyStats';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{
    mergeId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();
  const { mergeId } = await context.params;

  try {
    const result = await undoFamilyMerge({ db: getAdminDb(), uid, mergeId });
    if (!result.ok) return fail(result.code, result.message, statusForMutation(result));
    clearShelfStatsCache(uid);
    return ok(result.value);
  } catch (error) {
    console.error(`POST /api/v1/family-merges/${mergeId}/undo failed`, error);
    return fail('internal_error', 'Failed to undo family merge', 500);
  }
}
