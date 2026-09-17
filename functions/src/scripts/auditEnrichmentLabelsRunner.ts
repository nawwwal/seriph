import { getFirestore, type Query } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import { censusEnrichmentLabels, parseCensusArgs, type CensusFamily } from "./auditEnrichmentLabels";

export async function runEnrichmentLabelCensus(argv = process.argv.slice(2)): Promise<void> {
  if (!getApps().length) initializeApp();
  const args = parseCensusArgs(argv);
  const db = getFirestore();
  let query: Query = db.collection(FAMILIES_COLLECTION).select("enrichment");
  if (args.ownerId) query = query.where("ownerId", "==", args.ownerId);
  if (args.limit) query = query.limit(args.limit);
  const families = (await query.get()).docs.map((doc) => doc.data() as CensusFamily);
  console.log(JSON.stringify(censusEnrichmentLabels(families), null, 2));
}
