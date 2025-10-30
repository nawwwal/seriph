import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { FontFamily } from '@/models/font.models';

export const runtime = 'nodejs';

type RouteContext = {
  params: {
    familyId: string;
  };
};

async function loadFamily(db: Firestore, familyId: string): Promise<FontFamily | null> {
  if (!familyId) {
    return null;
  }
  const snapshot = await db.collection('fontfamilies').doc(familyId).get();
  if (!snapshot.exists) {
    return null;
  }
  const data = snapshot.data() as FontFamily;
  return { ...data, id: data.id ?? snapshot.id };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { familyId } = context.params;
  try {
    const db = getAdminDb();
    const family = await loadFamily(db, familyId);
    if (!family) {
      return NextResponse.json({ error: 'Family not found' }, { status: 404 });
    }
    return NextResponse.json({ family });
  } catch (error: any) {
    console.error(`GET /api/families/${familyId} failed`, error);
    return NextResponse.json(
      { error: 'Failed to fetch family' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { familyId } = context.params;
  const uid = await getUidFromRequest(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const familyRef = db.collection('fontfamilies').doc(familyId);
    const snapshot = await familyRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Family not found' }, { status: 404 });
    }
    const existing = snapshot.data() as FontFamily;
    if (existing.ownerId && existing.ownerId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = await request.json();
    const allowedKeys: Array<keyof FontFamily> = [
      'description',
      'tags',
      'classification',
      'metadata',
      'foundry',
    ];

    const updates: Partial<FontFamily> = {};
    for (const key of allowedKeys) {
      if (key in payload) {
        (updates as any)[key] = payload[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No updatable fields provided' },
        { status: 400 }
      );
    }

    (updates as any).lastModified = admin.firestore.FieldValue.serverTimestamp();
    await familyRef.set(updates, { merge: true });

    const updated = await loadFamily(db, familyId);
    return NextResponse.json({ family: updated });
  } catch (error: any) {
    console.error(`PATCH /api/families/${familyId} failed`, error);
    return NextResponse.json(
      { error: 'Failed to update family' },
      { status: 500 }
    );
  }
}
