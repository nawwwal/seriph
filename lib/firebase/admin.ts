import { App, getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

// Singleton initializer for Firebase Admin in Next.js (server-only)
// Credentials resolution priority:
// 1) Explicit service account envs: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
// 2) Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or GCP runtime SA)

const bucketName =
  process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

let cachedApp: App | null = null;
let initError: Error | null = null;

function initializeFirebaseAdmin(): App | null {
  if (cachedApp) {
    return cachedApp;
  }

  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0]!;
    return cachedApp;
  }

  try {
    if (projectId && clientEmail && rawPrivateKey) {
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
      cachedApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        storageBucket: bucketName,
        projectId,
      });
      return cachedApp;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT) {
      cachedApp = initializeApp({
        credential: applicationDefault(),
        storageBucket: bucketName,
        projectId: process.env.GOOGLE_CLOUD_PROJECT || projectId,
      });
      return cachedApp;
    }

    throw new Error(
      'Firebase Admin credentials not found. Set FIREBASE_ADMIN_* env vars or GOOGLE_APPLICATION_CREDENTIALS.'
    );
  } catch (error: any) {
    initError = error instanceof Error ? error : new Error(String(error));
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[firebase-admin] Initialization skipped:', initError.message);
    }
    return null;
  }
}

function requireFirebaseAdmin(): App {
  const app = initializeFirebaseAdmin();
  if (!app) {
    throw initError ||
      new Error(
        'Firebase Admin not initialized. Provide credentials before invoking server-side Firebase helpers.'
      );
  }
  return app;
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(initializeFirebaseAdmin());
}

export function getAdminDb(): Firestore {
  return getFirestore(requireFirebaseAdmin());
}

export function getAdminStorage(): Storage {
  return getStorage(requireFirebaseAdmin());
}
