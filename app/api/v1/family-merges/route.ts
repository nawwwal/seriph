import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { readJsonObject } from '@/lib/server/apiRequest';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { getOwnedFamily } from '@/lib/server/catalogFamilies';
import { applyFamilyMerge } from '@/lib/server/familyMutations';
import { statusForMutation } from '@/lib/server/familyMutationStore';
import { rebuildCatalogSummary } from '@/lib/server/catalogSummary';

export const runtime = 'nodejs';

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function POST(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();

  try {
    const body = await readJsonObject(request);
    if (!body.ok) return fail('bad_request', body.message, 400);
    const payload = body.value;
    const targetFamilyId = typeof payload.targetFamilyId === 'string' ? payload.targetFamilyId : '';
    const familyIds = strings(payload.familyIds);
    const db = getAdminDb();
    const result = await applyFamilyMerge({ db, uid, familyIds, targetFamilyId });
    if (!result.ok) return fail(result.code, result.message, statusForMutation(result));
    await rebuildCatalogSummary(db, uid);
    const family = await getOwnedFamily(db, uid, result.value.targetFamilyId);
    return ok({
      mergeId: result.value.mergeId,
      targetFamilyId: result.value.targetFamilyId,
      undoExpiresAt: result.value.undoExpiresAt,
      family,
    });
  } catch (error) {
    console.error('POST /api/v1/family-merges failed', error);
    return fail('internal_error', 'Failed to merge families', 500);
  }
}
