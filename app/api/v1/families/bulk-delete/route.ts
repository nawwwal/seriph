import { NextRequest } from 'next/server';
import { getAdminDb, getAdminStorage } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { readJsonObject } from '@/lib/server/apiRequest';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { applyFamilyHardDelete } from '@/lib/server/familyMutations';
import { statusForMutation } from '@/lib/server/familyMutationStore';
import { clearShelfStatsCache } from '@/lib/server/catalogFamilyStats';

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
    if (payload.confirm !== 'DELETE') return fail('bad_request', 'Type DELETE to confirm permanent deletion.', 400);
    const result = await applyFamilyHardDelete({
      db: getAdminDb(),
      storage: getAdminStorage(),
      uid,
      familyIds: strings(payload.familyIds),
    });
    if (!result.ok) return fail(result.code, result.message, statusForMutation(result));
    clearShelfStatsCache(uid);
    return ok({
      deletedFamilyIds: result.value.docIds,
      deletedAssetCount: result.value.storagePaths.length,
    });
  } catch (error) {
    console.error('POST /api/v1/families/bulk-delete failed', error);
    return fail('internal_error', 'Failed to delete families', 500);
  }
}
