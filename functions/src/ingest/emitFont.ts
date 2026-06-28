import { createHash } from "crypto";
import * as admin from "firebase-admin";
import { db, storage } from "../bootstrap/adminApp";
import { bumpLedger, isDuplicate } from "./intakeLedger";

/**
 * Create an ingest doc for a font extracted from an archive (never pre-registered
 * by the client), then place it in the unprocessed prefix so
 * `processUploadedFontStorage` picks it up. Dedupes by content hash.
 */
export async function emitFont(params: {
  bucket: string;
  buffer: Buffer;
  fileName: string;
  ownerId: string | null;
  batchId: string | null;
  relPath: string;
  unprocessedPrefix: string;
}): Promise<void> {
  const { bucket, buffer, fileName, ownerId, batchId, relPath, unprocessedPrefix } = params;

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
  await storage.bucket(bucket).file(dest).save(buffer, {
    resumable: false,
    metadata: { metadata: { ownerId: ownerId || "", batchId: batchId || "", relPath } },
  });
  await bumpLedger(ownerId, batchId, "fonts");
}
