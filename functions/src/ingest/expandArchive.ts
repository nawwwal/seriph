import { logger } from "firebase-functions";
import type { StorageObjectData } from "firebase-functions/v2/storage";
import { storage } from "../bootstrap/adminApp";
import { initializeRemoteConfig, getConfigValue } from "../config/remoteConfig";
import { RC_KEYS, RC_DEFAULTS } from "../config/rcKeys";
import { extOf, bumpLedger } from "./intakeLedger";
import { emitFont } from "./emitFont";
import { FONT_EXTS, MAX_EXPAND_DEPTH, MAX_INLINE_ZIP_BYTES, expandZip } from "./expandZip";
import { parseIntakePath, processingIdFromObjectName } from "./intakePath";
import { loadRegisteredIntake } from "./intakeRegistration";

/**
 * Handle one object landing in the intake prefix:
 *  - font  → emit to unprocessed (creating an ingest if needed)
 *  - zip   → stream-unzip; fonts emitted, nested zips written back to intake (recurse)
 *  - other → ignore (counted)
 */
export async function expandIntakeObject(event: { data: StorageObjectData }): Promise<null> {
  try {
    await initializeRemoteConfig();
  } catch {
    // defaults
  }

  const INTAKE = getConfigValue(RC_KEYS.intakeBucketPath, RC_DEFAULTS[RC_KEYS.intakeBucketPath]);
  const UNPROCESSED = getConfigValue(RC_KEYS.unprocessedBucketPath, RC_DEFAULTS[RC_KEYS.unprocessedBucketPath]);

  const filePath = event.data.name;
  if (!filePath || filePath.endsWith("/")) return null;
  const intakePath = parseIntakePath(filePath, INTAKE);
  if (!intakePath) return null;
  if (event.data.metadata?.processed === "true") return null;

  const meta = event.data.metadata || {};
  const processingId = (meta.processingId as string) || processingIdFromObjectName(intakePath.objectName);
  const registered = await loadRegisteredIntake(intakePath.ownerId, processingId);
  const ownerId = registered?.ownerId || intakePath.ownerId || (meta.ownerId as string) || null;
  const batchId = registered?.batchId || intakePath.batchId || (meta.batchId as string) || null;
  const relPath = registered?.relPath || (meta.relPath as string) || intakePath.objectName;
  const depth = Number.parseInt((meta.expandDepth as string) || "0", 10) || 0;

  const fileName = intakePath.objectName.split("/").pop()!;
  const ext = extOf(fileName);
  const bucketName = event.data.bucket;
  const srcFile = storage.bucket(bucketName).file(filePath);

  const markProcessed = async () => {
    try {
      await srcFile.setMetadata({ metadata: { ...meta, processed: "true" } });
    } catch {
      // ignore
    }
  };

  if (FONT_EXTS.includes(ext)) {
    const [buffer] = await srcFile.download();
    await emitFont({
      bucket: bucketName,
      buffer,
      fileName,
      ownerId,
      batchId,
      relPath,
      unprocessedPrefix: UNPROCESSED,
      sourceProcessingId: processingId,
    });
    await srcFile.delete({ ignoreNotFound: true });
    return null;
  }

  if (ext === "zip") {
    if (depth >= MAX_EXPAND_DEPTH) {
      logger.warn(`Max expand depth reached for ${filePath}; skipping`);
      await markProcessed();
      return null;
    }
    await bumpLedger(ownerId, batchId, "zips");
    const sizeBytes = Number.parseInt((event.data.size as unknown as string) || "0", 10) || 0;
    if (sizeBytes > MAX_INLINE_ZIP_BYTES) {
      logger.warn(`Zip ${filePath} exceeds inline limit (${sizeBytes}B); skipping`);
      await bumpLedger(ownerId, batchId, "oversized");
      await markProcessed();
      return null;
    }
    const [buffer] = await srcFile.download();
    await expandZip(buffer, { bucket: bucketName, intake: INTAKE, unprocessed: UNPROCESSED, ownerId, batchId, relPath, depth });
    await srcFile.delete({ ignoreNotFound: true });
    return null;
  }

  await bumpLedger(ownerId, batchId, "skipped");
  await markProcessed();
  return null;
}
