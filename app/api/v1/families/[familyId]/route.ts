import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { readJsonObject } from '@/lib/server/apiRequest';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { getOwnedFamily, patchOwnedFamily } from '@/lib/server/catalogFamilies';
import { clearShelfStatsCache } from '@/lib/server/catalogFamilyStats';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{
    familyId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();
  const { familyId } = await context.params;

  try {
    const family = await getOwnedFamily(getAdminDb(), uid, familyId);
    if (!family) return fail('not_found', 'Family not found', 404);
    return ok({ family });
  } catch (error) {
    console.error(`GET /api/v1/families/${familyId} failed`, error);
    return fail('internal_error', 'Failed to fetch family', 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();
  const { familyId } = await context.params;

  try {
    const body = await readJsonObject(request);
    if (!body.ok) return fail('bad_request', body.message, 400);
    const family = await patchOwnedFamily({
      db: getAdminDb(),
      uid,
      familyId,
      payload: body.value,
    });
    if (!family) return fail('not_found', 'Family not found', 404);
    clearShelfStatsCache(uid);
    return ok({ family });
  } catch (error) {
    console.error(`PATCH /api/v1/families/${familyId} failed`, error);
    return fail('internal_error', 'Failed to update family', 500);
  }
}
