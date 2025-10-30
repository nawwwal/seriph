import { NextRequest } from 'next/server';
import * as admin from 'firebase-admin';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';

export async function getUidFromRequest(request: NextRequest): Promise<string | null> {
  if (!isFirebaseAdminConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Firebase Admin is not configured; skipping auth token verification.');
    }
    return null;
  }

  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length);
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}
