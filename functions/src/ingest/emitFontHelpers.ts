import * as admin from "firebase-admin";
import { db } from "../bootstrap/adminApp";

export function planFontEmission(params: {
  fileName: string;
  sourceProcessingId?: string;
  allocatedProcessingId?: string;
}): { processingId: string; originalName: string; shouldCreateIngest: boolean } {
  const { fileName, sourceProcessingId, allocatedProcessingId } = params;
  if (sourceProcessingId) {
    const prefix = `${sourceProcessingId}-`;
    return {
      processingId: sourceProcessingId,
      originalName: fileName.startsWith(prefix) ? fileName.slice(prefix.length) : fileName,
      shouldCreateIngest: false,
    };
  }

  return {
    processingId: allocatedProcessingId ?? db.collection("_").doc().id,
    originalName: fileName,
    shouldCreateIngest: true,
  };
}

export async function updateSourceIngest(
  ownerId: string | null,
  processingId: string,
  fields: Record<string, unknown>
): Promise<void> {
  if (!ownerId) return;
  const snap = await db.collection("users").doc(ownerId).collection("ingests")
    .where("processingId", "==", processingId)
    .limit(1)
    .get();
  if (snap.empty) return;
  await snap.docs[0].ref.update({
    ...fields,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
