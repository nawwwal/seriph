import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { readJsonObject } from '@/lib/server/apiRequest';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { getOwnedFamily } from '@/lib/server/catalogFamilies';
import type { FontFamily } from '@/models/font.models';

export const runtime = 'nodejs';

// Strip ownerId before returning family data externally.
type SharedFamily = Omit<FontFamily, 'ownerId'>;

function sanitize(family: FontFamily): SharedFamily {
  const out = { ...family } as Partial<FontFamily> & SharedFamily;
  delete (out as Record<string, unknown>).ownerId;
  return out as SharedFamily;
}

function familyIdsFromBody(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.familyIds)) {
    return body.familyIds.filter((id): id is string => typeof id === 'string');
  }
  return typeof body.familyId === 'string' ? [body.familyId] : [];
}

export async function GET(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();

  const familyId = request.nextUrl.searchParams.get('familyId') || '';
  if (!familyId) return fail('bad_request', 'familyId is required', 400);

  try {
    const family = await getOwnedFamily(getAdminDb(), uid, familyId);
    if (!family) return fail('not_found', 'Family not found', 404);
    return ok({ family: sanitize(family) });
  } catch (err: unknown) {
    console.error('GET /api/share failed', err);
    return fail('internal_error', 'Failed to fetch share payload', 500);
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();

  try {
    const body = await readJsonObject(request);
    if (!body.ok) return fail('bad_request', body.message, 400);
    const ids = familyIdsFromBody(body.value);
    if (ids.length === 0) return fail('bad_request', 'familyId or familyIds required', 400);

    const families: SharedFamily[] = [];
    for (const id of ids) {
      const f = await getOwnedFamily(getAdminDb(), uid, id);
      if (f) families.push(sanitize(f));
    }
    if (families.length === 0) return fail('not_found', 'No matching families found', 404);
    return ok({ families });
  } catch (err: unknown) {
    console.error('POST /api/share failed', err);
    return fail('internal_error', 'Failed to fetch share payload', 500);
  }
}
