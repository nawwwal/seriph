import { createHash } from "crypto";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import type { StorageObjectData } from "firebase-functions/v2/storage";
import * as unzipper from "unzipper";
import { initializeRemoteConfig, getConfigValue } from "../config/remoteConfig";
import { RC_KEYS, RC_DEFAULTS } from "../config/rcKeys";

const FONT_EXTS = ["ttf", "otf", "woff", "woff2", "eot"];
const MAX_EXPAND_DEPTH = 4;
// Inline (in-function) unzip ceiling. Larger archives should be routed to a
// Cloud Run job that streams from Storage (Phase 3 — not yet deployed).
const MAX_INLINE_ZIP_BYTES = 150 * 1024 * 1024;

// Lazily resolved: calling getFirestore()/getStorage() at module load runs before
// initializeApp() (during deploy analysis and at cold start) and throws app/no-app.
let _db: ReturnType<typeof getFirestore> | null = null;
let _storage: ReturnType<typeof getStorage> | null = null;
function getDb() {
  return (_db ??= getFirestore());
}
function getStore() {
  return (_storage ??= getStorage());
}

function extOf(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

/** Bump a per-batch ledger counter (best-effort). */
async function bumpLedger(
  ownerId: string | null,
  batchId: string | null,
  field: string,
  by = 1
): Promise<void> {
  if (!ownerId || !batchId) return;
  const db = getDb();
  try {
    await db
      .collection("users")
      .doc(ownerId)
      .collection("batches")
      .doc(batchId)
      .set(
        {
          [field]: admin.firestore.FieldValue.increment(by),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  } catch (e: any) {
    logger.warn("Ledger bump failed", { message: e?.message });
  }
}

/** Skip duplicates already ingested by this user (best-effort contentHash gate). */
async function isDuplicate(ownerId: string | null, contentHash?: string): Promise<boolean> {
  if (!ownerId || !contentHash) return false;
  const db = getDb();
  try {
    const snap = await db
      .collection("users")
      .doc(ownerId)
      .collection("ingests")
      .where("contentHash", "==", contentHash)
      .limit(1)
      .get();
    return !snap.empty;
  } catch {
    return false;
  }
}

/**
 * Create an ingest doc for a font that was extracted from an archive (these were
 * never pre-registered by the client), then place it in the unprocessed prefix so
 * `processUploadedFontStorage` picks it up.
 */
async function emitFont(params: {
  bucket: string;
  buffer: Buffer;
  fileName: string;
  ownerId: string | null;
  batchId: string | null;
  relPath: string;
  unprocessedPrefix: string;
}): Promise<void> {
  const { bucket, buffer, fileName, ownerId, batchId, relPath, unprocessedPrefix } = params;
  const db = getDb();
  const storage = getStore();

  // Dedup gate: skip fonts this user already has (by content hash).
  const contentHash = createHash("sha256").update(buffer).digest("hex");
  if (await isDuplicate(ownerId, contentHash)) {
    await bumpLedger(ownerId, batchId, "dupes");
    return;
  }

  const processingId = db.collection("_").doc().id;

  if (ownerId) {
    const ingestRef = db.collection("users").doc(ownerId).collection("ingests").doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    await ingestRef.set({
      ingestId: ingestRef.id,
      ownerId,
      processingId,
      originalName: fileName,
      relPath,
      batchId,
      contentHash,
      status: "uploaded",
      uploadState: "uploaded",
      uploadProgress: 100,
      analysisState: "queued",
      error: null,
      uploadSource: "archive-expand",
      createdAt: now,
      updatedAt: now,
      uploadedAt: now,
    });
  }

  const dest = `${unprocessedPrefix}/${processingId}-${fileName}`;
  await storage
    .bucket(bucket)
    .file(dest)
    .save(buffer, {
      resumable: false,
      metadata: { metadata: { ownerId: ownerId || "", batchId: batchId || "", relPath } },
    });
  await bumpLedger(ownerId, batchId, "fonts");
}

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

  const db = getDb();
  const storage = getStore();

  const INTAKE = getConfigValue(RC_KEYS.intakeBucketPath, RC_DEFAULTS[RC_KEYS.intakeBucketPath]);
  const UNPROCESSED = getConfigValue(
    RC_KEYS.unprocessedBucketPath,
    RC_DEFAULTS[RC_KEYS.unprocessedBucketPath]
  );

  const filePath = event.data.name;
  if (!filePath || !filePath.startsWith(`${INTAKE}/`) || filePath.endsWith("/")) return null;
  if (event.data.metadata?.processed === "true") return null;

  const meta = event.data.metadata || {};
  const ownerId = (meta.ownerId as string) || null;
  const batchId = (meta.batchId as string) || null;
  const relPath = (meta.relPath as string) || filePath.split("/").pop()!;
  const depth = Number.parseInt((meta.expandDepth as string) || "0", 10) || 0;

  const fileName = filePath.split("/").pop()!;
  const ext = extOf(fileName);
  const bucketName = event.data.bucket;
  const srcFile = storage.bucket(bucketName).file(filePath);

  // Mark processed up-front so re-finalizes don't re-trigger.
  const markProcessed = async () => {
    try {
      await srcFile.setMetadata({ metadata: { ...meta, processed: "true" } });
    } catch {
      // ignore
    }
  };

  if (FONT_EXTS.includes(ext)) {
    const [buffer] = await srcFile.download();
    await emitFont({ bucket: bucketName, buffer, fileName, ownerId, batchId, relPath, unprocessedPrefix: UNPROCESSED });
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
      // TODO(Phase 3): hand off to a Cloud Run job that streams the archive.
      logger.warn(`Zip ${filePath} exceeds inline limit (${sizeBytes}B); skipping`);
      await bumpLedger(ownerId, batchId, "oversized");
      await markProcessed();
      return null;
    }
    const [buffer] = await srcFile.download();
    let directory: unzipper.CentralDirectory;
    try {
      directory = await unzipper.Open.buffer(buffer);
    } catch (e: any) {
      logger.error(`Failed to open zip ${filePath}`, { message: e?.message });
      await markProcessed();
      return null;
    }

    for (const entry of directory.files) {
      if (entry.type !== "File") continue;
      const entryName = entry.path.split("/").pop() || entry.path;
      if (!entryName || entryName.startsWith(".")) continue;
      const entryExt = extOf(entryName);
      const entryRel = `${relPath}/${entry.path}`;

      if (FONT_EXTS.includes(entryExt)) {
        const content = await entry.buffer();
        await emitFont({
          bucket: bucketName,
          buffer: content,
          fileName: entryName,
          ownerId,
          batchId,
          relPath: entryRel,
          unprocessedPrefix: UNPROCESSED,
        });
      } else if (entryExt === "zip") {
        // Write nested archive back into intake to recurse via this same trigger.
        const content = await entry.buffer();
        const nestedDest = `${INTAKE}/${batchId || "nested"}/${db.collection("_").doc().id}-${entryName}`;
        await storage
          .bucket(bucketName)
          .file(nestedDest)
          .save(content, {
            resumable: false,
            metadata: {
              metadata: {
                ownerId: ownerId || "",
                batchId: batchId || "",
                relPath: entryRel,
                expandDepth: String(depth + 1),
              },
            },
          });
      } else {
        await bumpLedger(ownerId, batchId, "skipped");
      }
    }

    await srcFile.delete({ ignoreNotFound: true });
    return null;
  }

  // Unknown type: ignore (counted) and mark processed.
  await bumpLedger(ownerId, batchId, "skipped");
  await markProcessed();
  return null;
}

export { isDuplicate };
