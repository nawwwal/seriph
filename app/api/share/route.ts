import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import type { FontFamily } from '@/models/font.models';

export const runtime = 'nodejs';

// Strip ownerId before returning family data externally.
type SharedFamily = Omit<FontFamily, 'ownerId'>;

function sanitize(family: FontFamily): SharedFamily {
  const out = { ...family } as Partial<FontFamily> & SharedFamily;
  delete (out as Record<string, unknown>).ownerId;
  return out as SharedFamily;
}

async function getOwnedFamily(
  uid: string,
  familyId: string
): Promise<FontFamily | null> {
  const db = getAdminDb();
  const snap = await db.collection('fontfamilies').doc(familyId).get();
  if (!snap.exists) return null;
  const data = snap.data() as FontFamily;
  if (data.ownerId !== uid) return null;
  return { ...data, id: data.id ?? snap.id };
}

export async function GET(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const familyId = request.nextUrl.searchParams.get('familyId') || '';
  if (!familyId) {
    return NextResponse.json({ error: 'familyId is required' }, { status: 400 });
  }

  try {
    const family = await getOwnedFamily(uid, familyId);
    if (!family) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ family: sanitize(family) });
  } catch (err: unknown) {
    console.error('GET /api/share failed', err);
    return NextResponse.json({ error: 'Failed to fetch share payload' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const ids: string[] = Array.isArray(body?.familyIds)
      ? body.familyIds
      : body?.familyId
      ? [body.familyId]
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'familyId or familyIds required' }, { status: 400 });
    }

    const families: SharedFamily[] = [];
    for (const id of ids) {
      const f = await getOwnedFamily(uid, id);
      if (f) families.push(sanitize(f));
    }
    if (families.length === 0) {
      return NextResponse.json({ error: 'No matching families found' }, { status: 404 });
    }
    return NextResponse.json({ families });
  } catch (err: unknown) {
    console.error('POST /api/share failed', err);
    return NextResponse.json({ error: 'Failed to fetch share payload' }, { status: 500 });
  }
}
