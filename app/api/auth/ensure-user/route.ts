import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();

  try {
    const adminDb = getAdminDb();
    const userRecord = await getAdminAuth().getUser(uid);
    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();

    const serverTimestamp = FieldValue.serverTimestamp();

    if (!userDoc.exists) {
      // Create user document if it doesn't exist
      await userRef.set({
        uid: uid,
        email: userRecord.email || null,
        displayName: userRecord.displayName || null,
        photoURL: userRecord.photoURL || null,
        createdAt: serverTimestamp,
        lastSeen: serverTimestamp,
      });
      return ok({ message: 'User profile created', created: true });
    } else {
      await userRef.update({
        lastSeen: serverTimestamp,
      });
      return ok({ message: 'User profile updated', created: false });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error ensuring user profile:', error);
    return fail(
      'internal_error',
      'Failed to ensure user profile',
      500,
      process.env.NODE_ENV === 'development' ? message : undefined
    );
  }
}
