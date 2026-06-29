import { createHash } from "crypto";
import * as admin from "firebase-admin";
import { db, storage } from "../bootstrap/adminApp";
import { bumpLedger, isDuplicate } from "./intakeLedger";
import { planFontEmission, updateSourceIngest } from "./emitFontHelpers";

export { planFontEmission } from "./emitFontHelpers";

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
  sourceProcessingId?: string | null;
}): Promise<void> {
  const { bucket, buffer, fileName, ownerId, batchId, relPath, unprocessedPrefix, sourceProcessingId } = params;

  const contentHash = createHash("sha256").update(buffer).digest("hex");
  if (await isDuplicate(ownerId, contentHash)) {
    if (sourceProcessingId) {
      await updateSourceIngest(ownerId, sourceProcessingId, {
        contentHash,
        status: "completed",
        uploadState: "uploaded",
        uploadProgress: 100,
        analysisState: "complete",
        error: null,
        uploadSource: "direct-upload-duplicate",
      });
    }
    await bumpLedger(ownerId, batchId, "dupes");
    return;
  }

  const plan = planFontEmission({
    fileName,
    sourceProcessingId: sourceProcessingId || undefined,
    allocatedProcessingId: db.collection("_").doc().id,
  });

  if (ownerId && plan.shouldCreateIngest) {
    const ingestRef = db.collection("users").doc(ownerId).collection("ingests").doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    await ingestRef.set({
      ingestId: ingestRef.id,
      ownerId,
      processingId: plan.processingId,
      originalName: plan.originalName,
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
  } else if (ownerId) {
    await updateSourceIngest(ownerId, plan.processingId, {
      originalName: plan.originalName,
      relPath,
      batchId,
      contentHash,
      status: "uploaded",
      uploadState: "uploaded",
      uploadProgress: 100,
      analysisState: "queued",
      error: null,
      uploadSource: "direct-upload",
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  const dest = `${unprocessedPrefix}/${plan.processingId}-${plan.originalName}`;
  await storage.bucket(bucket).file(dest).save(buffer, {
    resumable: false,
    metadata: { metadata: { ownerId: ownerId || "", batchId: batchId || "", relPath, processingId: plan.processingId } },
  });
  await bumpLedger(ownerId, batchId, "fonts");
}
