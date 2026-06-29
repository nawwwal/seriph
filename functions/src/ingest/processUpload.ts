import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import type { StorageObjectData } from "firebase-functions/v2/storage";
import { db, storage } from "../bootstrap/adminApp";
import { initializeRemoteConfig, getConfigValue } from "../config/remoteConfig";
import { RC_KEYS, RC_DEFAULTS } from "../config/rcKeys";
import { ingestFont } from "../storage/ingest";
import { updateIngestState } from "./ingestState";

/**
 * Store-first ingestion for one object under the unprocessed prefix: parse →
 * canonicalize → woff2 → public bucket → family doc (`ready`). The font is
 * viewable + downloadable as soon as this finishes; enrichment runs on the
 * batch cadence.
 */
export async function handleUnprocessedObject(event: { data: StorageObjectData }): Promise<null> {
  try {
    await initializeRemoteConfig();
  } catch (e: any) {
    logger.warn("Remote Config init failed; using defaults", { message: e?.message });
  }

  const UNPROCESSED = getConfigValue(RC_KEYS.unprocessedBucketPath, RC_DEFAULTS[RC_KEYS.unprocessedBucketPath]);
  const FAILED = getConfigValue(RC_KEYS.failedBucketPath, RC_DEFAULTS[RC_KEYS.failedBucketPath]);

  const filePath = event.data.name;
  const contentType = event.data.contentType;
  if (!filePath || !filePath.startsWith(`${UNPROCESSED}/`) || filePath.endsWith("/")) return null;
  if (event.data.metadata?.processed === "true") return null;

  const fileName = filePath.split("/").pop()!;
  const m = fileName.match(/^([^-]+)-(.+)$/);
  const processingId = m ? m[1] : db.collection("_").doc().id;
  const actualName = m ? m[2] : fileName;
  const ownerId = event.data.metadata?.ownerId || null;

  const srcFile = storage.bucket(event.data.bucket).file(filePath);
  await updateIngestState(processingId, ownerId, {
    uploadState: "uploaded",
    uploadProgress: 100,
    analysisState: "queued",
  });

  const t0 = Date.now();
  try {
    const [buffer] = await srcFile.download();
    await updateIngestState(processingId, ownerId, { analysisState: "analyzing" });
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
      analysisState: "enriching",
      status: "processing",
      familyId: result.family.id,
    });
    await srcFile.delete({ ignoreNotFound: true });

    try {
      await db.collection("metrics_ai").doc(processingId).set(
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
