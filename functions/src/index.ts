import { statSync } from "fs";
import { resolve } from "path";
// Firebase Admin SDK
import * as admin from "firebase-admin";

// Firebase Functions
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";

// --- Rebuilt pipeline modules ---
import { initializeRemoteConfig, getConfigValue } from "./config/remoteConfig";
import { RC_KEYS, RC_DEFAULTS } from "./config/rcKeys";
import { ingestFont } from "./storage/ingest";
import { enrichFamily } from "./ai/enrichFont";
import { searchFonts } from "./search/searchFonts";
import { css2Handler, serveFontHandler } from "./serve/handlers";
import { FAMILIES_COLLECTION } from "./storage/familyStore";
import type { FontFamilyDoc } from "./models/catalog.models";

type ServiceAccountConfig = admin.ServiceAccount & {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function coercePrivateKey(input?: string | null): string | null {
  if (!input) return null;
  let pk = input.trim();
  const looksLikeBase64 = !pk.includes("BEGIN PRIVATE KEY") && /^[A-Za-z0-9+/=\s]+$/.test(pk);
  if (looksLikeBase64) {
    try {
      pk = Buffer.from(pk, "base64").toString("utf8");
    } catch (error) {
      logger.warn("Failed to decode base64 private key", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  pk = pk.replace(/\\n/g, "\n");
  pk = pk.replace(/^"+|"+$/g, "");
  pk = pk.replace(/^-*BEGIN PRIVATE KEY-*$/m, "-----BEGIN PRIVATE KEY-----");
  pk = pk.replace(/^-*END PRIVATE KEY-*$/m, "-----END PRIVATE KEY-----");
  pk = pk.replace(/(-----BEGIN PRIVATE KEY-----)([^\n])/, "$1\n$2");
  pk = pk.replace(/([^\n])(-----END PRIVATE KEY-----)/, "$1\n$2");
  if (!pk.endsWith("\n")) pk += "\n";
  if (!pk.includes("BEGIN PRIVATE KEY")) {
    return pk;
  }
  return pk;
}

function serviceAccountFromJson(json: string, source: string): admin.ServiceAccount | null {
  try {
    const parsed: ServiceAccountConfig = JSON.parse(json);
    const clientEmail = parsed.client_email ?? parsed.clientEmail;
    const privateKey = coercePrivateKey(parsed.private_key ?? parsed.privateKey);
    const projectId =
      parsed.project_id ??
      parsed.projectId ??
      process.env.FIREBASE_ADMIN_PROJECT_ID ??
      process.env.GOOGLE_CLOUD_PROJECT ??
      undefined;

    if (!clientEmail || !privateKey) {
      logger.error(`Service account JSON from ${source} is missing clientEmail/privateKey.`);
      return null;
    }

    return {
      projectId,
      clientEmail,
      privateKey,
    };
  } catch (error) {
    logger.error(`Failed to parse service account JSON from ${source}.`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function decodeBase64Credentials(value: string, source: string): admin.ServiceAccount | null {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return serviceAccountFromJson(decoded, source);
  } catch (error) {
    logger.error(`Failed to decode base64 service account from ${source}.`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function loadServiceAccountFromEnv(): admin.ServiceAccount | null {
  const inlineCredentialEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (inlineCredentialEnv) {
    const trimmed = inlineCredentialEnv.trim();
    if (trimmed.startsWith("{")) {
      const parsed = serviceAccountFromJson(trimmed, "GOOGLE_APPLICATION_CREDENTIALS");
      if (parsed) {
        return parsed;
      }
    }
  }

  const jsonSources: Array<[string | undefined, string]> = [
    [process.env.FIREBASE_ADMIN_CREDENTIALS, "FIREBASE_ADMIN_CREDENTIALS"],
    [process.env.GOOGLE_CREDENTIALS, "GOOGLE_CREDENTIALS"],
    [process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, "GOOGLE_APPLICATION_CREDENTIALS_JSON"],
  ];

  for (const [value, source] of jsonSources) {
    if (value) {
      const parsed = serviceAccountFromJson(value, source);
      if (parsed) {
        return parsed;
      }
    }
  }

  const base64Sources: Array<[string | undefined, string]> = [
    [process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64, "FIREBASE_ADMIN_CREDENTIALS_BASE64"],
    [process.env.GOOGLE_CREDENTIALS_BASE64, "GOOGLE_CREDENTIALS_BASE64"],
    [process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, "GOOGLE_APPLICATION_CREDENTIALS_BASE64"],
  ];

  for (const [value, source] of base64Sources) {
    if (value) {
      const parsed = decodeBase64Credentials(value, source);
      if (parsed) {
        return parsed;
      }
    }
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = coercePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? null);
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? undefined;

  if (clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  return null;
}

function credentialPathLooksValid(filePath: string): boolean {
  try {
    const stats = statSync(filePath);
    return stats.isFile();
  } catch (_) {
    return false;
  }
}

function sanitizeGoogleApplicationCredentialsEnv(): void {
  const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!configured) {
    return;
  }

  const trimmed = configured.trim();
  if (!trimmed) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return;
  }

  const resolvedPaths = new Set<string>([trimmed, resolve(trimmed)]);
  if (trimmed.startsWith("file://")) {
    try {
      resolvedPaths.add(new URL(trimmed).pathname);
    } catch (_) {
      // Ignore URL parsing errors
    }
  }
  const hasValidFile = Array.from(resolvedPaths).some(credentialPathLooksValid);

  if (!hasValidFile) {
    logger.warn("GOOGLE_APPLICATION_CREDENTIALS path is invalid. Falling back to default application credentials.", {
      configured: trimmed,
    });
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
}

function initializeFirebaseAdminApp(): void {
  const appOptions: admin.AppOptions = {};
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.GOOGLE_CLOUD_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (storageBucket) {
    appOptions.storageBucket = storageBucket;
  }

  const serviceAccount = loadServiceAccountFromEnv();
  if (serviceAccount) {
    appOptions.credential = admin.credential.cert(serviceAccount);
    if (!appOptions.projectId && serviceAccount.projectId) {
      appOptions.projectId = serviceAccount.projectId;
    }
  } else {
    sanitizeGoogleApplicationCredentialsEnv();
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

initializeFirebaseAdminApp();

// Ensure Firestore drops undefined fields on write (global)
try {
  getFirestore().settings({ ignoreUndefinedProperties: true });
} catch (_) {
  // If settings already applied or Firestore not ready, ignore.
}

const firestoreDb = getFirestore();
const appStorage = getStorage();

/** Update an ingest record's state by processingId (best-effort, non-fatal). */
async function updateIngestState(
  processingId: string,
  ownerId: string | null,
  fields: Record<string, unknown>
): Promise<void> {
  if (!ownerId) return;
  try {
    const ingestsRef = firestoreDb.collection("users").doc(ownerId).collection("ingests");
    const snap = await ingestsRef.where("processingId", "==", processingId).limit(1).get();
    if (snap.empty) return;
    await snap.docs[0].ref.update({
      ...fields,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e: any) {
    logger.warn(`Failed to update ingest ${processingId}`, { message: e?.message });
  }
}

/**
 * Store-first ingestion trigger. Uploads land in `unprocessed_bucket_path`; we
 * parse, canonicalize (Google Fonts model), transcode to woff2, write canonical
 * assets to the public bucket, and upsert the family doc (status `ready`). The
 * font is viewable + downloadable as soon as this finishes. Enrichment runs
 * separately via `enrichFontOnReady`.
 */
export const processUploadedFontStorage = onObjectFinalized(
  { region: "asia-southeast1", memory: "1GiB", timeoutSeconds: 300 },
  async (event) => {
    try {
      await initializeRemoteConfig();
    } catch (e: any) {
      logger.warn("Remote Config init failed; using defaults", { message: e?.message });
    }

    const UNPROCESSED = getConfigValue(RC_KEYS.unprocessedBucketPath, RC_DEFAULTS[RC_KEYS.unprocessedBucketPath]);
    const FAILED = getConfigValue(RC_KEYS.failedBucketPath, RC_DEFAULTS[RC_KEYS.failedBucketPath]);

    const filePath = event.data.name;
    const contentType = event.data.contentType;
    if (!filePath || !filePath.startsWith(`${UNPROCESSED}/`) || filePath.endsWith("/")) {
      return null;
    }
    if (event.data.metadata?.processed === "true") return null;

    const fileName = filePath.split("/").pop()!;
    const m = fileName.match(/^([^-]+)-(.+)$/);
    const processingId = m ? m[1] : firestoreDb.collection("_").doc().id;
    const actualName = m ? m[2] : fileName;
    const ownerId = event.data.metadata?.ownerId || null;

    const srcFile = appStorage.bucket(event.data.bucket).file(filePath);
    await updateIngestState(processingId, ownerId, { analysisState: "queued" });

    const t0 = Date.now();
    try {
      const [buffer] = await srcFile.download();
      const result = await ingestFont({
        fileBuffer: buffer,
        originalFilename: actualName,
        ownerId: ownerId || undefined,
        contentType: contentType || undefined,
      });

      if (!result) {
        await updateIngestState(processingId, ownerId, {
          analysisState: "error",
          status: "failed",
          error: "Parse/ingest failed",
        });
        await srcFile.move(`${FAILED}/${processingId}-${actualName}`);
        return null;
      }

      await updateIngestState(processingId, ownerId, {
        analysisState: "complete",
        status: "completed",
        familyId: result.family.id,
      });
      await srcFile.delete({ ignoreNotFound: true });

      try {
        await firestoreDb.collection("metrics_ai").doc(processingId).set(
          {
            processingId,
            familyId: result.family.id,
            durations: { totalMs: Date.now() - t0 },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
        // metrics are non-fatal
      }
    } catch (e: any) {
      logger.error(`Ingestion failed for ${actualName}`, { message: e?.message, stack: e?.stack });
      await updateIngestState(processingId, ownerId, {
        analysisState: "error",
        status: "failed",
        error: e?.message,
      });
      try {
        await srcFile.move(`${FAILED}/${processingId}-${actualName}`);
      } catch {
        // ignore move failure
      }
    }
    return null;
  }
);

/**
 * Enrichment trigger: when a family doc becomes `ready`, run the async
 * multimodal enrichment + embedding. Only acts on the `ready` state, so the
 * `enriching`/`enriched` writes it makes don't re-trigger work.
 */
export const enrichFontOnReady = onDocumentWritten(
  {
    region: "asia-southeast1",
    memory: "1GiB",
    timeoutSeconds: 300,
    document: `${FAMILIES_COLLECTION}/{slug}`,
  },
  async (event) => {
    const after = event.data?.after?.data() as FontFamilyDoc | undefined;
    if (!after || after.status !== "ready") return;
    try {
      await initializeRemoteConfig();
    } catch {
      // defaults
    }
    try {
      await enrichFamily(event.params.slug as string);
    } catch (e: any) {
      logger.error(`Enrichment failed for ${event.params.slug}`, { message: e?.message });
    }
  }
);

/** Semantic font search. POST { q?, filters?, limit? }. */
export const searchFontsHttp = onRequest({ region: "asia-southeast1", cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    await initializeRemoteConfig();
  } catch {
    // defaults
  }
  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const response = await searchFonts(payload);
    res.status(200).json(response);
  } catch (e: any) {
    logger.error("searchFontsHttp failed", { message: e?.message, stack: e?.stack });
    res.status(500).json({ error: "Search failed", details: e?.message });
  }
});

/** Google-Fonts-style CSS API. GET /css2?family=... (Firebase Hosting rewrites /css2 here). */
export const css2 = onRequest({ region: "asia-southeast1", cors: true }, async (req, res) => {
  try {
    await initializeRemoteConfig();
  } catch {
    // defaults
  }
  await css2Handler(req as any, res as any);
});

/** Font asset serving: /s/** (web woff2) and /d/** (original download). Hosting rewrites here. */
export const serveFont = onRequest({ region: "asia-southeast1", cors: true }, async (req, res) => {
  try {
    await initializeRemoteConfig();
  } catch {
    // defaults
  }
  await serveFontHandler(req as any, res as any);
});
