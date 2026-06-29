import { getFirestore, type DocumentSnapshot, type Query } from "firebase-admin/firestore";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import type { MigrationArgs } from "./migrateOldSchemaTypes";
import { catalogDocIdArg } from "./migrateOldSchemaTypes";

export async function listLegacyDocs(args: MigrationArgs): Promise<DocumentSnapshot[]> {
  const db = getFirestore();
  if (args.ownerId) {
    if (args.familyIds?.length) {
      const refs = args.familyIds.map((id) => db.collection("users").doc(args.ownerId!).collection(FAMILIES_COLLECTION).doc(id));
      return Promise.all(refs.map((ref) => ref.get()));
    }
    let query: Query = db.collection("users").doc(args.ownerId).collection(FAMILIES_COLLECTION);
    if (args.limit) query = query.limit(args.limit);
    return (await query.get()).docs;
  }

  if (!args.allOwners) throw new Error("Pass --ownerId=<uid> or explicit --allOwners before scanning production data.");
  const users = await db.collection("users").get();
  const docs: DocumentSnapshot[] = [];
  for (const user of users.docs) {
    if (args.familyIds?.length) {
      const refs = args.familyIds.map((id) => user.ref.collection(FAMILIES_COLLECTION).doc(id));
      docs.push(...await Promise.all(refs.map((ref) => ref.get())));
    } else {
      const remaining = args.limit ? args.limit - docs.length : undefined;
      if (remaining !== undefined && remaining <= 0) break;
      let query: Query = user.ref.collection(FAMILIES_COLLECTION);
      if (remaining) query = query.limit(remaining);
      docs.push(...(await query.get()).docs);
    }
    if (args.limit && docs.length >= args.limit) break;
  }
  return docs;
}

export async function listCatalogDocs(args: MigrationArgs): Promise<DocumentSnapshot[]> {
  const db = getFirestore();
  if (args.familyIds?.length) {
    const refs = args.familyIds.map((id) => db.collection(FAMILIES_COLLECTION).doc(catalogDocIdArg(id, args.ownerId)));
    return Promise.all(refs.map((ref) => ref.get()));
  }
  let query: Query = db.collection(FAMILIES_COLLECTION);
  if (args.ownerId) query = query.where("ownerId", "==", args.ownerId);
  if (args.limit) query = query.limit(args.limit);
  return (await query.get()).docs;
}
