import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { FontFamily, Font } from '@/models/font.models';

export const runtime = 'nodejs';

type SanitizedFont = Omit<Font, 'metadata'> & { metadata?: Record<string, unknown> };

type SanitizedFamily = Omit<FontFamily, 'ownerId'> & {
  ownerId?: never;
  fonts: SanitizedFont[];
};

function sanitizeFamily(family: FontFamily): SanitizedFamily {
  const { fonts: originalFonts } = family;
  const safeFonts: SanitizedFont[] = (originalFonts ?? []).map((font) => {
    return {
      ...font,
      metadata: font.metadata
        ? {
            ...font.metadata,
          }
        : undefined,
    };
  });

  const sanitized = {
    ...family,
    fonts: safeFonts,
  } as SanitizedFamily;

  delete (sanitized as Record<string, unknown>).ownerId;
  return sanitized;
}

async function getFamily(db: Firestore, familyId: string, ownerId?: string): Promise<FontFamily | null> {
  if (!familyId) return null;
  if (ownerId) {
    const snap = await db.collection('users').doc(ownerId).collection('fontfamilies').doc(familyId).get();
    if (snap.exists) {
      const data = snap.data() as FontFamily;
      return { ...data, id: data.id ?? snap.id };
    }
  }
  // Legacy fallback
  const legacy = await db.collection('fontfamilies').doc(familyId).get();
  if (legacy.exists) {
    const data = legacy.data() as FontFamily;
    return { ...data, id: data.id ?? legacy.id };
  }
  return null;
}

export async function GET(request: NextRequest) {
  const familyId = request.nextUrl.searchParams.get('familyId') || '';
  const ownerId = request.nextUrl.searchParams.get('ownerId') || undefined;
  if (!familyId) {
    return NextResponse.json(
      { error: 'familyId query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const db = getAdminDb();
    const family = await getFamily(db, familyId, ownerId);
    if (!family) {
      return NextResponse.json({ error: 'Family not found' }, { status: 404 });
    }
    return NextResponse.json({ family: sanitizeFamily(family) });
  } catch (error: any) {
    console.error(`GET /api/share?familyId=${familyId} failed`, error);
    return NextResponse.json(
      { error: 'Failed to prepare share payload' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getAdminDb();
    const body = await request.json();
    const familyIds: string[] = Array.isArray(body?.familyIds)
      ? body.familyIds
      : body?.familyId
      ? [body.familyId]
      : [];

    if (familyIds.length === 0) {
      return NextResponse.json(
        { error: 'familyId or familyIds required in request body' },
        { status: 400 }
      );
    }

    const families: SanitizedFamily[] = [];
    const ownerId = request.nextUrl.searchParams.get('ownerId') || undefined;
    for (const familyId of familyIds) {
      const family = await getFamily(db, familyId, ownerId);
      if (family) {
        families.push(sanitizeFamily(family));
      }
    }

    if (families.length === 0) {
      return NextResponse.json(
        { error: 'No matching families found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ families });
  } catch (error: any) {
    console.error('POST /api/share failed', error);
    return NextResponse.json(
      { error: 'Failed to prepare share payload' },
      { status: 500 }
    );
  }
}
