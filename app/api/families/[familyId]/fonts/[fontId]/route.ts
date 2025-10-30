import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { FontFamily } from '@/models/font.models';

export const runtime = 'nodejs';

type RouteContext = {
  params: {
    familyId: string;
    fontId: string;
  };
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { familyId, fontId } = context.params;
  const uid = await getUidFromRequest(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const familyRef = db.collection('users').doc(uid).collection('fontfamilies').doc(familyId);
    const snapshot = await familyRef.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Family not found' }, { status: 404 });
    }

    const family = snapshot.data() as FontFamily;
    if (family.ownerId && family.ownerId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentFonts = family.fonts || [];
    const nextFonts = currentFonts.filter((font) => font.id !== fontId);

    if (nextFonts.length === currentFonts.length) {
      return NextResponse.json({ error: 'Font not found' }, { status: 404 });
    }

    await familyRef.set(
      {
        fonts: nextFonts,
        lastModified: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ message: 'Font removed', fonts: nextFonts });
  } catch (error: any) {
    console.error(
      `DELETE /api/families/${familyId}/fonts/${fontId} failed`,
      error
    );
    return NextResponse.json(
      { error: 'Failed to delete font from family' },
      { status: 500 }
    );
  }
}
