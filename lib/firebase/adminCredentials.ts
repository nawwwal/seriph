import { applicationDefault, cert, type AppOptions } from 'firebase-admin/app';
import { coercePrivateKey } from './privateKey';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

interface JsonServiceAccount {
  private_key: string;
  client_email: string;
  project_id?: string;
}

function isServiceAccount(value: unknown): value is JsonServiceAccount {
  return isRecord(value) && typeof value.private_key === 'string' && typeof value.client_email === 'string';
}

function serviceAccountFromJson(jsonStr: string) {
  try {
    const parsed: unknown = JSON.parse(jsonStr);
    if (!isServiceAccount(parsed)) return null;
    const privateKey = coercePrivateKey(parsed.private_key);
    if (!privateKey) return null;
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey };
  } catch {
    return null;
  }
}

function serviceAccountFromEnv() {
  const credsJson = process.env.FIREBASE_ADMIN_CREDENTIALS || process.env.GOOGLE_CREDENTIALS;
  const credsB64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64 || process.env.GOOGLE_CREDENTIALS_BASE64;
  if (credsJson) return serviceAccountFromJson(credsJson);
  if (!credsB64) return null;
  try {
    return serviceAccountFromJson(Buffer.from(credsB64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export function firebaseAdminAppOptions(bucketName: string | undefined): AppOptions | null {
  const serviceAccount = serviceAccountFromEnv();
  if (serviceAccount) {
    return {
      credential: cert(serviceAccount),
      storageBucket: bucketName,
      projectId: serviceAccount.projectId || projectId,
    };
  }
  if (clientEmail && rawPrivateKey) {
    const privateKey = coercePrivateKey(rawPrivateKey);
    if (!privateKey) return null;
    return {
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket: bucketName,
      projectId,
    };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT) {
    return {
      credential: applicationDefault(),
      storageBucket: bucketName,
      projectId: process.env.GOOGLE_CLOUD_PROJECT || projectId,
    };
  }
  return null;
}
