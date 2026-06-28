import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { db } from "../bootstrap/adminApp";

export function extOf(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

/** Bump a per-batch ledger counter (best-effort). */
export async function bumpLedger(
  ownerId: string | null,
  batchId: string | null,
  field: string,
  by = 1
): Promise<void> {
  if (!ownerId || !batchId) return;
  try {
    await db
      .collection("users").doc(ownerId)
      .collection("batches").doc(batchId)
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
export async function isDuplicate(ownerId: string | null, contentHash?: string): Promise<boolean> {
  if (!ownerId || !contentHash) return false;
  try {
    const snap = await db
      .collection("users").doc(ownerId)
      .collection("ingests")
      .where("contentHash", "==", contentHash)
      .limit(1)
      .get();
    return !snap.empty;
  } catch {
    return false;
  }
}
