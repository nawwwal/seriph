import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminDb = getAdminDb();
    // Get user record from Firebase Auth
    const userRecord = await admin.auth().getUser(uid);
    
    // Check if user document exists in Firestore
    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();

    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

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
      return NextResponse.json({ message: 'User profile created', created: true });
    } else {
      // Update lastSeen timestamp
      await userRef.update({
        lastSeen: serverTimestamp,
      });
      return NextResponse.json({ message: 'User profile updated', created: false });
    }
  } catch (error: any) {
    console.error('Error ensuring user profile:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return NextResponse.json(
      { 
        error: 'Failed to ensure user profile',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}
