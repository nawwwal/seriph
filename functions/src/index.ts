import { statSync } from "fs";
import { resolve } from "path";
// Firebase Admin SDK
import * as admin from "firebase-admin";

// Firebase Functions
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { logger } from "firebase-functions";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";

// Helper imports (ensure these paths are correct based on your structure within functions/src)
import { serverParseFontFile } from "./parser/fontParser";
import { serverAddFontToFamilyAdmin } from "./db/firestoreUtils.admin";
import { runFontPipeline } from "./ai/pipeline/fontPipeline";
import { withRateLimit } from "./utils/rateLimiter";
import { initializeRemoteConfig, getConfigValue, getConfigBoolean } from "./config/remoteConfig";
import { RC_KEYS, RC_DEFAULTS } from "./config/rcKeys";

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

const firestoreDb = getFirestore(); // Renamed to avoid conflict if 'firestore' is used as a module
const appStorage = getStorage(); // Renamed to avoid conflict

/**
 * Update ingest record analysis state
 */
async function updateIngestAnalysisState(
  processingId: string,
  ownerId: string | null,
  analysisState: 'queued' | 'analyzing' | 'enriching' | 'complete' | 'error' | 'quarantined',
  error?: string
): Promise<void> {
  if (!ownerId) {
    logger.warn(`Cannot update ingest record: no ownerId for processingId ${processingId}`);
    return;
  }

  try {
    // Find ingest record by processingId
    const ingestsRef = firestoreDb.collection('users').doc(ownerId).collection('ingests');
    const querySnapshot = await ingestsRef.where('processingId', '==', processingId).limit(1).get();

    if (querySnapshot.empty) {
      logger.warn(`No ingest record found for processingId ${processingId}`);
      return;
    }

    const ingestDoc = querySnapshot.docs[0];
    await ingestDoc.ref.update({
      analysisState,
      error: error || admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Updated ingest ${ingestDoc.id} analysisState to ${analysisState}`);
  } catch (error: any) {
    logger.error(`Failed to update ingest analysisState for ${processingId}:`, error);
    // Non-fatal: continue processing even if state update fails
  }
}

export const processUploadedFontStorage = onObjectFinalized(
  {
    bucket: admin.storage().bucket().name, // Uses the default bucket associated with the Firebase project
    region: "asia-southeast1", // Align with Vertex regional choice
    memory: "1GiB",        // Specify memory allocation
    timeoutSeconds: 540,   // Specify timeout
  },
  async (event) => {
    // Await Remote Config to avoid cold-start defaults
    try {
      await initializeRemoteConfig();
    } catch (e: any) {
      logger.warn('Remote Config initialization failed, using defaults:', { message: e?.message });
    }

    const UNPROCESSED_BUCKET_PATH = getConfigValue(RC_KEYS.unprocessedBucketPath, RC_DEFAULTS[RC_KEYS.unprocessedBucketPath]);
    const PROCESSED_BUCKET_PATH = getConfigValue(RC_KEYS.processedBucketPath, RC_DEFAULTS[RC_KEYS.processedBucketPath]);
    const FAILED_BUCKET_PATH = getConfigValue(RC_KEYS.failedBucketPath, RC_DEFAULTS[RC_KEYS.failedBucketPath]);

    const fileBucket = event.data.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;

    if (!filePath || !filePath.startsWith(`${UNPROCESSED_BUCKET_PATH}/`)) {
      logger.log("File is not in the designated unprocessed directory. Ignoring.", { path: filePath });
      return null;
    }

    if (filePath.endsWith("/")) {
      logger.log("This is a folder creation event. Ignoring.", { path: filePath });
      return null;
    }

    // The onObjectFinalized trigger ensures the object exists.
    // Further checks for metadata can prevent reprocessing.
    if (event.data.metadata && event.data.metadata.processed === 'true') {
        logger.log("File has metadata indicating it was already processed. Ignoring.", {path: filePath});
        return null;
    }

    const originalFileName = filePath.split("/").pop();
    if (!originalFileName) {
      logger.error("Could not extract original file name from path.", { path: filePath });
      return null;
    }

    logger.info(`Processing file: ${originalFileName} from ${filePath}`);

    const bucket = appStorage.bucket(fileBucket);
    const unprocessedFile = bucket.file(filePath);
    
    // Extract processingId from filename (format: {processingId}-{originalFileName})
    const processingIdMatch = originalFileName.match(/^([^-]+)-(.+)$/);
    const processingId = processingIdMatch ? processingIdMatch[1] : admin.firestore().collection('_').doc().id;
    const actualFileName = processingIdMatch ? processingIdMatch[2] : originalFileName;
    
    // Get ownerId from file metadata (metadata is flat, not nested)
    const ownerIdFromMetadata = event.data.metadata?.ownerId || null;
    
    // Update analysis state to queued
    await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'queued');

    // Metrics timing
    const t0 = Date.now();
    let tParse = 0;
    let tPipeline = 0;
    let tPersist = 0;
    let limiterWaitMs = 0; // Placeholder if you add wait time tracking in rateLimiter

    try {
      const [fileBuffer] = await unprocessedFile.download();
      logger.info(`[${originalFileName}] Downloaded ${fileBuffer.byteLength} bytes.`);

      logger.info(`[${originalFileName}] Parsing font file...`);
      const tParseStart = Date.now();
      const parsedFontData = await serverParseFontFile(fileBuffer, originalFileName);
      tParse = Date.now() - tParseStart;

      if (!parsedFontData) {
        logger.error(`[${actualFileName}] Failed to parse font.`);
        await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'error', 'Failed to parse font file');
        const failedFilePath = `${FAILED_BUCKET_PATH}/${processingId}-${actualFileName}`;
        await unprocessedFile.move(failedFilePath);
        logger.info(`[${actualFileName}] Moved to ${failedFilePath}.`);
        return null;
      }
      logger.info(`[${actualFileName}] Parsed font successfully. Family: ${parsedFontData.familyName}, Subfamily: ${parsedFontData.subfamilyName}, Foundry: ${parsedFontData.foundry || 'N/A'}`);

      // Update analysis state to analyzing (beginning AI path)
      await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'analyzing');

      // Run enhanced AI pipeline with rate limiting
      logger.info(`[${actualFileName}] Starting enhanced AI pipeline for: ${parsedFontData.familyName}`);
      let pipelineResult = null;
      let aiAnalysisResult = null;

      try {
        const tPipeStart = Date.now();
        pipelineResult = await withRateLimit(
          () => runFontPipeline(fileBuffer, actualFileName),
          `Font pipeline for ${actualFileName}`
        );
        tPipeline = Date.now() - tPipeStart;

        // Update to enriching if web enrichment is enabled (RC)
        const webEnrichmentEnabled = getConfigBoolean(RC_KEYS.webEnrichmentEnabled, false);
        if (webEnrichmentEnabled && pipelineResult) {
          await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'enriching' as any);
        }

        if (pipelineResult && pipelineResult.isValid) {
          // Convert pipeline result to legacy format for compatibility
          const enrichedAnalysis = pipelineResult.enrichedAnalysis || pipelineResult.visualAnalysis;
          if (enrichedAnalysis) {
            aiAnalysisResult = {
              description: pipelineResult.description || 'A well-designed font family.',
              tags: enrichedAnalysis.moods?.slice(0, 5).map((m: any) => m.value) || [],
              classification: enrichedAnalysis.style_primary?.value || parsedFontData.classification || 'Sans Serif',
              metadata: {
                subClassification: enrichedAnalysis.substyle?.value,
                moods: enrichedAnalysis.moods?.map((m: any) => m.value) || [],
                useCases: enrichedAnalysis.use_cases?.map((uc: any) => uc.value) || [],
                technicalCharacteristics: enrichedAnalysis.negative_tags || [],
                // Enhanced fields
                people: enrichedAnalysis.people,
                historical_context: enrichedAnalysis.historical_context,
                semantics: enrichedAnalysis,
                provenance: pipelineResult.parsedData?.provenance,
              },
            };
            logger.info(`[${actualFileName}] Enhanced AI pipeline completed successfully. Confidence: ${pipelineResult.confidence.toFixed(2)}`);
          }
        } else {
          logger.warn(`[${actualFileName}] Enhanced AI pipeline failed or returned invalid results.`);
        }
      } catch (pipelineError: any) {
        logger.error(`[${actualFileName}] Enhanced pipeline error:`, pipelineError);
        // Update to error state
        await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'error' as any, pipelineError.message);
      }

      if (!aiAnalysisResult) {
        logger.warn(`[${actualFileName}] AI analysis failed or returned no data. Proceeding with basic data.`);
        await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'error', 'AI analysis failed');
      } else {
        logger.info(`[${actualFileName}] AI analysis completed for ${parsedFontData.familyName}.`);
      }

      const processedFileName = `${processingId}-${actualFileName}`;
      const processedFileRef = bucket.file(`${PROCESSED_BUCKET_PATH}/${processedFileName}`);

      const tPersistStart = Date.now();
      await processedFileRef.save(fileBuffer, {
        resumable: false,
        // Set contentType at the top level per GCS SaveOptions
        contentType: contentType || 'application/octet-stream',
        // cacheControl belongs in FileMetadata under `metadata`
        metadata: {
          cacheControl: 'public, max-age=31536000',
          // custom user metadata goes under `metadata`
          metadata: {
            processed: 'true',
            originalPath: filePath,
            processingId: processingId,
            ...(ownerIdFromMetadata ? { ownerId: ownerIdFromMetadata } : {}),
          },
        },
      });
      await processedFileRef.makePublic();
      const downloadUrl = processedFileRef.publicUrl();
      logger.info(`[${originalFileName}] Font saved to ${processedFileRef.name} and made public at ${downloadUrl}`);
      tPersist = Date.now() - tPersistStart;

      const fontFileDetails = {
        originalName: originalFileName,
        storagePath: processedFileRef.name,
        downloadUrl: downloadUrl,
        fileSize: fileBuffer.byteLength,
      };

      // Merge pipeline result data into parsedFontData if available
      const enhancedParsedData = pipelineResult?.parsedData || parsedFontData;
      if (pipelineResult?.visualMetrics) {
        enhancedParsedData.visual_metrics = pipelineResult.visualMetrics;
      }

      const familyResult = await serverAddFontToFamilyAdmin(enhancedParsedData, fontFileDetails, aiAnalysisResult, ownerIdFromMetadata || undefined);

      if (!familyResult) {
        logger.error(`[${actualFileName}] Failed to add font to family in Firestore. Attempting to move processed file to failed folder.`);
        await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'error', 'Failed to add font to family');
        const failedFilePath = `${FAILED_BUCKET_PATH}/${processedFileName}`;
        try {
          await processedFileRef.move(failedFilePath);
          logger.info(`[${actualFileName}] Moved processed file from ${processedFileRef.name} to ${failedFilePath} after DB error.`);
        } catch (moveError: any) {
          logger.error(`[${actualFileName}] Failed to move processed file ${processedFileRef.name} to failed folder. Manual cleanup may be needed.`, { error: moveError.message });
        }
        try {
            await unprocessedFile.delete({ ignoreNotFound: true });
            logger.info(`[${actualFileName}] Deleted original unprocessed file after DB error and moving processed to failed.`);
        } catch (delError: any) {
            logger.warn(`[${actualFileName}] Could not delete original unprocessed file. It might have been deleted already.`, {error: delError.message});
        }
        return null;
      }
      logger.info(`[${actualFileName}] Successfully added font to family: ${familyResult.name} (ID: ${familyResult.id}) in Firestore.`);

      // Update analysis state to complete
      await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'complete');

      // Update ingest record with familyId and mark as completed
      try {
        const ingestsRef = firestoreDb.collection('users').doc(ownerIdFromMetadata!).collection('ingests');
        const querySnapshot = await ingestsRef.where('processingId', '==', processingId).limit(1).get();
        if (!querySnapshot.empty) {
          const ingestDoc = querySnapshot.docs[0];
          await ingestDoc.ref.update({
            status: 'completed',
            familyId: familyResult.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (updateError: any) {
        logger.warn(`[${actualFileName}] Failed to update ingest record with familyId:`, updateError);
      }

      await unprocessedFile.delete();
      logger.info(`[${actualFileName}] Successfully processed. Original file ${filePath} deleted.`);
      // Write metrics document (optional)
      try {
        const metricsDoc = {
          processingId,
          filePath,
          bytes: event.data.size ? Number(event.data.size) : fileBuffer.byteLength,
          durations: {
            totalMs: Date.now() - t0,
            parseMs: tParse,
            pipelineMs: tPipeline,
            persistMs: tPersist,
            limiterWaitMs,
          },
          modelInfo: {
            region: getConfigValue(RC_KEYS.vertexLocationId, RC_DEFAULTS[RC_KEYS.vertexLocationId]),
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await firestoreDb.collection('metrics_ai').doc(processingId).set(metricsDoc, { merge: true });
      } catch (metricsErr: any) {
        logger.warn(`[${actualFileName}] Failed to write metrics_ai`, { message: metricsErr?.message });
      }

    } catch (error: any) {
      logger.error(`[${actualFileName}] Unhandled error in processUploadedFontStorage:`, {
        message: error.message,
        stack: error.stack,
        filePath: filePath
      });
      
      // Update ingest record to error state (reuse ownerIdFromMetadata from outer scope)
      await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'error', error.message);
      
      try {
        const failedFilePath = `${FAILED_BUCKET_PATH}/${processingId}-${actualFileName}`;
        await unprocessedFile.move(failedFilePath);
        logger.info(`[${actualFileName}] Moved original unprocessed file to ${failedFilePath} after unhandled error.`);
      } catch (moveError: any) {
        logger.error(`[${actualFileName}] CRITICAL: Failed to move original unprocessed file to ${FAILED_BUCKET_PATH} after unhandled error. File may be stuck in ${UNPROCESSED_BUCKET_PATH}.`, { moveError: moveError.message });
      }
    }
    return null;
  }
);

/**
 * Admin/test-only HTTP endpoint to run the font pipeline on a supplied font.
 * Request body JSON:
 * {
 *   "base64": "AA...", // base64-encoded font file (preferred)
 *   "filename": "MyFont.ttf",
 *   // or alternatively:
 *   "url": "https://..." // public URL to fetch font bytes
 * }
 */
export const testFontPipeline = onRequest(
  {
    region: "asia-southeast1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }
      const { base64, url, filename } = (req.body || {}) as { base64?: string; url?: string; filename?: string };
      if (!base64 && !url) {
        res.status(400).json({ error: 'Provide "base64" or "url" in request body' });
        return;
      }
      const name = filename || 'UploadedFont.ttf';
      let buffer: Buffer;
      if (base64) {
        buffer = Buffer.from(base64, 'base64');
      } else {
        if (!url) {
          res.status(400).json({ error: 'Provide "url" in request body' });
          return;
        }
        const r = await fetch(url);
        if (!r.ok) {
          res.status(400).json({ error: `Failed to fetch url: ${r.status} ${r.statusText}` });
          return;
        }
        const arr = await r.arrayBuffer();
        buffer = Buffer.from(arr);
      }
      const result = await runFontPipeline(buffer, name);
      res.status(200).json({ ok: true, result });
    } catch (e: any) {
      logger.error('testFontPipeline error', { message: e?.message, stack: e?.stack });
      res.status(500).json({ ok: false, error: e?.message || 'Unknown error' });
    }
  }
);

/**
 * Admin-only HTTP endpoint to batch reprocess existing fonts through the AI pipeline.
 * Request body JSON:
 * {
 *   "ownerId": "user_uid",         // optional, scopes to user collection
 *   "familyIds": ["id1","id2"],    // optional, specific families only
 *   "limit": 10,                   // optional, max families to process
 *   "force": false                 // optional, ignore caches
 * }
 */
export const batchReprocessFonts = onRequest(
  {
    region: "asia-southeast1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }
      const { ownerId, familyIds, limit, force } = (req.body || {}) as {
        ownerId?: string;
        familyIds?: string[];
        limit?: number;
        force?: boolean;
      };

      const maxFamilies = Math.min(Math.max(Number(limit) || 10, 1), 50);
      const familiesCol = ownerId
        ? firestoreDb.collection('users').doc(ownerId).collection('fontfamilies')
        : firestoreDb.collection('fontfamilies');

      let q = familiesCol.orderBy('lastModified', 'desc');
      if (Array.isArray(familyIds) && familyIds.length > 0) {
        // Fetch specific IDs
        const snaps = await Promise.all(familyIds.slice(0, maxFamilies).map((id) => familiesCol.doc(id).get()));
        const toProcess = snaps.filter((s) => s.exists).map((s) => ({ id: s.id, data: s.data() as any }));
        const results = await reprocessFamilies(toProcess, ownerId || null, force === true);
        res.status(200).json({ ok: true, processed: results.length });
        return;
      } else {
        const snap = await q.limit(maxFamilies).get();
        const toProcess = snap.docs.map((d) => ({ id: d.id, data: d.data() as any }));
        const results = await reprocessFamilies(toProcess, ownerId || null, force === true);
        res.status(200).json({ ok: true, processed: results.length });
        return;
      }
    } catch (e: any) {
      logger.error('batchReprocessFonts error', { message: e?.message, stack: e?.stack });
      res.status(500).json({ ok: false, error: e?.message || 'Unknown error' });
    }
  }
);

async function reprocessFamilies(
  families: Array<{ id: string; data: any }>,
  ownerId: string | null,
  force: boolean
): Promise<Array<{ id: string; fonts: number }>> {
  const out: Array<{ id: string; fonts: number }> = [];
  for (const fam of families) {
    try {
      const fonts: any[] = Array.isArray(fam.data?.fonts) ? fam.data.fonts : [];
      let processed = 0;
      for (const font of fonts) {
        try {
          // Determine storage path; fallback to downloadUrl fetching
          const storagePath: string | undefined = font?.metadata?.storagePath || font?.storagePath;
          let buffer: Buffer | null = null;
          if (storagePath) {
            const [file] = await appStorage.bucket().file(storagePath).download();
            buffer = file;
          } else if (typeof font?.downloadUrl === 'string' && font.downloadUrl.startsWith('http')) {
            const r = await fetch(font.downloadUrl);
            if (r.ok) {
              const arr = await r.arrayBuffer();
              buffer = Buffer.from(arr);
            }
          }
          if (!buffer) {
            logger.warn(`Skip font without accessible bytes in family ${fam.id}`);
            continue;
          }
          const filename = font?.filename || 'Unknown.ttf';
          const pipelineResult = await withRateLimit(
            () => runFontPipeline(buffer!, filename),
            `Batch reprocess ${filename}`
          );
          if (!pipelineResult) {
            logger.warn(`Pipeline returned null for ${filename} in family ${fam.id}`);
            continue;
          }
          // Legacy compatibility payload
          const enrichedAnalysis = pipelineResult.enrichedAnalysis || pipelineResult.visualAnalysis || {};
          const aiAnalysisResult = {
            description: pipelineResult.description || fam.data?.description || 'A font family.',
            tags: enrichedAnalysis.moods?.slice(0, 5).map((m: any) => m.value) || [],
            classification: enrichedAnalysis.style_primary?.value || fam.data?.classification || 'Sans Serif',
            metadata: {
              subClassification: enrichedAnalysis.substyle?.value,
              moods: enrichedAnalysis.moods?.map((m: any) => m.value) || [],
              useCases: enrichedAnalysis.use_cases?.map((uc: any) => uc.value) || [],
              technicalCharacteristics: enrichedAnalysis.negative_tags || [],
              people: enrichedAnalysis.people,
              historical_context: enrichedAnalysis.historical_context,
              semantics: enrichedAnalysis,
              provenance: pipelineResult.parsedData?.provenance,
            },
          };
          const enhancedParsedData = pipelineResult?.parsedData || {};
          if (pipelineResult?.visualMetrics) {
            (enhancedParsedData as any).visual_metrics = pipelineResult.visualMetrics;
          }
          await serverAddFontToFamilyAdmin(
            enhancedParsedData,
            {
              originalName: filename,
              storagePath: storagePath || '',
              downloadUrl: font?.downloadUrl || '',
              fileSize: buffer.length,
            },
            aiAnalysisResult,
            ownerId || undefined
          );
          processed++;
        } catch (fontErr: any) {
          logger.warn(`Failed to reprocess font in family ${fam.id}`, { message: fontErr?.message });
        }
      }
      out.push({ id: fam.id, fonts: processed });
    } catch (famErr: any) {
      logger.warn(`Family reprocess failed: ${fam.id}`, { message: famErr?.message });
    }
  }
  return out;
}
