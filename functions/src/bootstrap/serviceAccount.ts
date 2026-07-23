import type { ServiceAccount } from "firebase-admin/app";
import { logger } from "firebase-functions";
import { coercePrivateKey } from "./privateKey";

type ServiceAccountConfig = ServiceAccount & {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function fromJson(json: string, source: string): ServiceAccount | null {
  try {
    const parsed: ServiceAccountConfig = JSON.parse(json);
    const clientEmail = parsed.client_email ?? parsed.clientEmail;
    const privateKey = coercePrivateKey(parsed.private_key ?? parsed.privateKey);
    const projectId =
      parsed.project_id ?? parsed.projectId ?? process.env.FIREBASE_ADMIN_PROJECT_ID ??
      process.env.GOOGLE_CLOUD_PROJECT ?? undefined;
    if (!clientEmail || !privateKey) {
      logger.error(`Service account JSON from ${source} is missing clientEmail/privateKey.`);
      return null;
    }
    return { projectId, clientEmail, privateKey };
  } catch (error) {
    logger.error(`Failed to parse service account JSON from ${source}.`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function fromBase64(value: string, source: string): ServiceAccount | null {
  try {
    return fromJson(Buffer.from(value, "base64").toString("utf8"), source);
  } catch {
    return null;
  }
}

/** Resolve a service account from the supported credential env vars, in priority order. */
export function loadServiceAccountFromEnv(): ServiceAccount | null {
  const inline = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (inline?.startsWith("{")) {
    const parsed = fromJson(inline, "GOOGLE_APPLICATION_CREDENTIALS");
    if (parsed) return parsed;
  }

  const jsonSources: Array<[string | undefined, string]> = [
    [process.env.FIREBASE_ADMIN_CREDENTIALS, "FIREBASE_ADMIN_CREDENTIALS"],
    [process.env.GOOGLE_CREDENTIALS, "GOOGLE_CREDENTIALS"],
    [process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, "GOOGLE_APPLICATION_CREDENTIALS_JSON"],
  ];
  for (const [value, source] of jsonSources) {
    if (value) { const p = fromJson(value, source); if (p) return p; }
  }

  const base64Sources: Array<[string | undefined, string]> = [
    [process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64, "FIREBASE_ADMIN_CREDENTIALS_BASE64"],
    [process.env.GOOGLE_CREDENTIALS_BASE64, "GOOGLE_CREDENTIALS_BASE64"],
    [process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, "GOOGLE_APPLICATION_CREDENTIALS_BASE64"],
  ];
  for (const [value, source] of base64Sources) {
    if (value) { const p = fromBase64(value, source); if (p) return p; }
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = coercePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? null);
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? undefined;
  if (clientEmail && privateKey) return { projectId, clientEmail, privateKey };
  return null;
}
