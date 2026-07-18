import { DocumentReference, Firestore } from "firebase-admin/firestore";

const segment = (value: string, name: string): string => {
  if (!value || value.includes("/")) throw new Error(`invalid ${name}`);
  return value;
};

export const importBatchRef = (
  db: Firestore, ownerId: string, batchId: string,
): DocumentReference => db.collection("users").doc(segment(ownerId, "ownerId"))
  .collection("importBatches").doc(segment(batchId, "batchId"));

export const importSourceRef = (
  db: Firestore, ownerId: string, batchId: string, sourceId: string,
): DocumentReference => importBatchRef(db, ownerId, batchId)
  .collection("sources").doc(segment(sourceId, "sourceId"));
