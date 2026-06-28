import { App, getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getAuth, Auth } from 'firebase-admin/auth';
import { coercePrivateKey } from './privateKey';

// Singleton Firebase Admin initializer (server-only). Kept as one module by
// design: this is a single security-sensitive concern (credential resolution
// across env-var shapes), so it stays cohesive rather than fragmented. The pure
// PEM-coercion helper lives in ./privateKey. Slightly over the 100-line bar.

const bucketName =
  process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

function resolveServiceAccountFromJsonString(jsonStr: string) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.private_key && parsed.client_email) {
      parsed.private_key = coercePrivateKey(parsed.private_key);
      return parsed;
    }
  } catch (_) {
    // ignore
  }
  return null;
}

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
    // Option A: Full JSON credentials via FIREBASE_ADMIN_CREDENTIALS or GOOGLE_CREDENTIALS
    const credsJson = process.env.FIREBASE_ADMIN_CREDENTIALS || process.env.GOOGLE_CREDENTIALS;
    const credsB64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64 || process.env.GOOGLE_CREDENTIALS_BASE64;
    let saFromJson: any = null;
    if (credsJson) {
      saFromJson = resolveServiceAccountFromJsonString(credsJson);
    } else if (credsB64) {
      try {
        const decoded = Buffer.from(credsB64, 'base64').toString('utf8');
        saFromJson = resolveServiceAccountFromJsonString(decoded);
      } catch (_) {
        // ignore
      }
    }

    if (saFromJson) {
      cachedApp = initializeApp({
        credential: cert(saFromJson),
        storageBucket: bucketName,
        projectId: saFromJson.project_id || projectId,
      });
      return cachedApp;
    }

    // Option B: Env triplet (projectId optional)
    if (clientEmail && rawPrivateKey) {
      const privateKey = coercePrivateKey(rawPrivateKey);
      cachedApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey: privateKey as string }),
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
      'Firebase Admin credentials not found. Provide FIREBASE_ADMIN_CREDENTIALS (JSON), FIREBASE_ADMIN_CREDENTIALS_BASE64, FIREBASE_ADMIN_* triplet, or GOOGLE_APPLICATION_CREDENTIALS.'
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

export function getAdminAuth(): Auth {
  return getAuth(requireFirebaseAdmin());
}
