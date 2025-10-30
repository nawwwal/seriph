import { App, getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getAuth, Auth } from 'firebase-admin/auth';

// Singleton initializer for Firebase Admin in Next.js (server-only)
// Credentials resolution priority:
// 1) Explicit service account envs: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY

const bucketName =
  process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

function coercePrivateKey(input?: string | null): string | null {
  if (!input) return null;
  let pk = input.trim();
  // If it looks like base64 (no BEGIN header and lots of base64 chars), try to decode
  const looksLikeBase64 = !pk.includes('BEGIN PRIVATE KEY') && /^[A-Za-z0-9+/=\s]+$/.test(pk);
  if (looksLikeBase64) {
    try {
      pk = Buffer.from(pk, 'base64').toString('utf8');
    } catch (_) {
      // ignore, fall back to raw
    }
  }
  // Replace escaped newlines first (support both \n and \\\n)
  pk = pk.replace(/\\n/g, '\n');
  // Some hosting platforms double-quote the key; strip leading/trailing quotes
  pk = pk.replace(/^"+|"+$/g, '');
  // Normalize PEM header/footer hyphen counts and line placement
  pk = pk.replace(/^-*BEGIN PRIVATE KEY-*$/m, '-----BEGIN PRIVATE KEY-----');
  pk = pk.replace(/^-*END PRIVATE KEY-*$/m, '-----END PRIVATE KEY-----');
  // Ensure newline after header and before footer
  pk = pk.replace(/(-----BEGIN PRIVATE KEY-----)([^\n])/, '$1\n$2');
  pk = pk.replace(/([^\n])(-----END PRIVATE KEY-----)/, '$1\n$2');
  if (!pk.endsWith('\n')) pk += '\n';
  // Ensure proper PEM boundaries if missing
  if (!pk.includes('BEGIN PRIVATE KEY')) {
    // Do not attempt to fabricate if structure missing
    return pk;
  }
  return pk;
}

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
