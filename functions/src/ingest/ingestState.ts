import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { db } from "../bootstrap/adminApp";

/** Update an ingest record's state by processingId (best-effort, non-fatal). */
export async function updateIngestState(
  processingId: string,
  ownerId: string | null,
  fields: Record<string, unknown>
): Promise<void> {
  if (!ownerId) return;
  try {
    const ingestsRef = db.collection("users").doc(ownerId).collection("ingests");
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
