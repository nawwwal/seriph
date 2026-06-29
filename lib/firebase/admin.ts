import { App, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getAuth, Auth } from 'firebase-admin/auth';
import { firebaseAdminAppOptions } from './adminCredentials';

const bucketName =
  process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

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
    const appOptions = firebaseAdminAppOptions(bucketName);
    if (!appOptions) throw new Error('Firebase Admin credentials not found. Provide FIREBASE_ADMIN_CREDENTIALS, FIREBASE_ADMIN_CREDENTIALS_BASE64, FIREBASE_ADMIN_* triplet, or GOOGLE_APPLICATION_CREDENTIALS.');
    cachedApp = initializeApp(appOptions);
    return cachedApp;
  } catch (error: unknown) {
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

export function getAdminAuth(): Auth {
  return getAuth(requireFirebaseAdmin());
}
