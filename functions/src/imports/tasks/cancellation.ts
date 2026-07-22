import type { Firestore } from "firebase-admin/firestore";
import { importBatchRef } from "../store/paths";

export async function isImportBatchCanceled(db: Firestore, ownerId: string, batchId: string): Promise<boolean> {
  const snapshot = await importBatchRef(db, ownerId, batchId).get();
  return snapshot.exists && snapshot.data()?.outcome === "canceled";
}

export function isMissingStorageObject(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; statusCode?: unknown; response?: { statusCode?: unknown } };
  return [value.code, value.statusCode, value.response?.statusCode].some((code) => code === 404 || code === "404");
}
