import { getFirestore, type Query } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import type { FontFamilyDoc } from "../models/catalog.models";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import {
  buildBackfillUpdate,
  currentSearchBackfillVersion,
  parseBackfillArgs,
  shouldBackfillFamily,
} from "./backfillSearchVectors";

export async function runBackfillSearchVectors(argv = process.argv.slice(2)): Promise<void> {
  if (!getApps().length) initializeApp();
  const args = parseBackfillArgs(argv);
  const version = currentSearchBackfillVersion();
  const db = getFirestore();

  let query: Query = db.collection(FAMILIES_COLLECTION);
  if (args.ownerId) query = query.where("ownerId", "==", args.ownerId);
  if (args.limit) query = query.limit(args.limit);

  const snap = await query.get();
  let skipped = 0;
  let updated = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const family = { ...doc.data(), id: doc.id } as FontFamilyDoc;
    if (!shouldBackfillFamily(family, version, args.force)) {
      skipped += 1;
      continue;
    }

    try {
      if (!args.dryRun) {
        const update = await buildBackfillUpdate(family);
        await doc.ref.set(update, { merge: true });
      }
      updated += 1;
      console.log(`${args.dryRun ? "would update" : "updated"} ${doc.id}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`failed ${doc.id}: ${message}`);
    }
  }

  console.log(JSON.stringify({ scanned: snap.size, skipped, updated, failed, dryRun: args.dryRun }, null, 2));
  if (failed > 0) process.exitCode = 1;
}
