import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { readJsonObject } from '@/lib/server/apiRequest';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { getOwnedFamily } from '@/lib/server/catalogFamilies';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();

  try {
    const body = await readJsonObject(request);
    if (!body.ok) return fail('bad_request', body.message, 400);
    const ids = Array.isArray(body.value.familyIds)
      ? body.value.familyIds.filter((id): id is string => typeof id === 'string')
      : typeof body.value.familyId === 'string'
        ? [body.value.familyId]
        : [];
    if (ids.length === 0) return fail('bad_request', 'familyId or familyIds required', 400);

    const families = [];
    for (const id of ids) {
      const family = await getOwnedFamily(getAdminDb(), uid, id);
      if (family) {
        const { ownerId: _ownerId, ...safeFamily } = family;
        families.push(safeFamily);
      }
    }
    if (families.length === 0) return fail('not_found', 'No matching families found', 404);
    return ok({ families });
  } catch (error) {
    console.error('POST /api/v1/shares failed', error);
    return fail('internal_error', 'Failed to fetch share payload', 500);
  }
}
