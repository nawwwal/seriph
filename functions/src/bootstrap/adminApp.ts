import { statSync } from "fs";
import { resolve } from "path";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { loadServiceAccountFromEnv } from "./serviceAccount";
import { resolveStorageBucket } from "./storageBucket";

function credentialPathLooksValid(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/** Drop GOOGLE_APPLICATION_CREDENTIALS if it points at a missing file (so ADC can take over). */
function sanitizeCredentialsEnv(): void {
  const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!configured) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return;
  }
  const candidates = new Set<string>([configured, resolve(configured)]);
  if (configured.startsWith("file://")) {
    try { candidates.add(new URL(configured).pathname); } catch { /* ignore */ }
  }
  if (!Array.from(candidates).some(credentialPathLooksValid)) {
    logger.warn("GOOGLE_APPLICATION_CREDENTIALS path is invalid; falling back to ADC.", { configured });
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
}

function initializeFirebaseAdminApp(): void {
  const appOptions: admin.AppOptions = {};
  const storageBucket = resolveStorageBucket();
  if (storageBucket) appOptions.storageBucket = storageBucket;

  const serviceAccount = loadServiceAccountFromEnv();
  if (serviceAccount) {
    appOptions.credential = admin.credential.cert(serviceAccount);
    if (!appOptions.projectId && serviceAccount.projectId) appOptions.projectId = serviceAccount.projectId;
  } else {
    sanitizeCredentialsEnv();
    if (process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT) {
      appOptions.projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    }
  }

  try {
    admin.initializeApp(appOptions);
  } catch (error) {
    logger.error("Failed to initialize Firebase Admin app.", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Side effect: initialize the app on import, before any getFirestore()/getStorage() call.
initializeFirebaseAdminApp();
try {
  getFirestore().settings({ ignoreUndefinedProperties: true });
} catch {
  // already applied or not ready
}

export const db = getFirestore();
export const storage = getStorage();
