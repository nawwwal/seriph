import * as admin from 'firebase-admin';

// Singleton initializer for Firebase Admin in Next.js (server-only)
// Credentials resolution priority:
// 1) Explicit service account envs: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
// 2) Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or GCP runtime SA)

const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!admin.apps.length) {
  if (projectId && clientEmail && rawPrivateKey) {
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      storageBucket: bucketName,
    });
  } else {
    admin.initializeApp({
      storageBucket: bucketName,
    });
  }
}

export const adminApp = admin.app();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
export type { app as FirebaseAdminApp } from 'firebase-admin';
