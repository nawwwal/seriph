import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { FontFamily } from '@/models/font.models';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const uid = await getUidFromRequest(request);
    if (!uid) {
      return NextResponse.json({ families: [] });
    }

    const db = getAdminDb();
    const familiesRef = db.collection('users').doc(uid).collection('fontfamilies');
    const snapshot = await familiesRef.get();

    const families = snapshot.docs
      .map((doc) => {
        const data = doc.data() as FontFamily;
        return { ...data, id: data.id ?? doc.id } as FontFamily;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ families });
  } catch (error: any) {
    console.error('GET /api/families failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch families', details: error?.message },
      { status: 500 }
    );
  }
}
