import { db } from "../bootstrap/adminApp";

export interface RegisteredIntake {
  ownerId?: string;
  batchId?: string;
  relPath?: string;
}

export async function loadRegisteredIntake(
  ownerId: string | null,
  processingId: string | null
): Promise<RegisteredIntake | null> {
  if (!ownerId || !processingId) return null;
  const snap = await db.collection("users").doc(ownerId).collection("ingests")
    .where("processingId", "==", processingId)
    .limit(1)
    .get();
  const data = snap.docs[0]?.data();
  if (!data) return null;
  return {
    ownerId: typeof data.ownerId === "string" ? data.ownerId : undefined,
    batchId: typeof data.batchId === "string" ? data.batchId : undefined,
    relPath: typeof data.relPath === "string" ? data.relPath : undefined,
  };
}
