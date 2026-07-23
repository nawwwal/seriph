import type { Firestore } from "firebase-admin/firestore";
import { readImportReadiness, terminalItemState, terminalSourceState, type ImportReadiness } from "../store/batchStore";
import { importBatchRef } from "../store/paths";

type Row = Record<string, unknown>;

function readinessFromRows(sources: readonly Row[], items: readonly Row[]): ImportReadiness {
  return {
    version: 1,
    pendingSources: sources.filter((source) => !terminalSourceState(source.state)).length,
    pendingItems: items.filter((item) => !terminalItemState(item.state)).length,
    finalizationRequested: false,
  };
}

/** Migrate old batches once; normal completion uses the durable counters. */
export async function ensureImportReadiness(db: Firestore, batch: ReturnType<typeof importBatchRef>): Promise<ImportReadiness | undefined> {
  const current = await batch.get();
  if (!current.exists) return undefined;
  const existing = readImportReadiness(current.data()?.readiness);
  if (existing) return existing;
  const [sourceSnap, itemSnap] = await Promise.all([batch.collection("sources").get(), batch.collection("items").get()]);
  const migrated = readinessFromRows(sourceSnap.docs.map((doc) => doc.data() as Row), itemSnap.docs.map((doc) => doc.data() as Row));
  return db.runTransaction(async (tx) => {
    const latest = await tx.get(batch);
    if (!latest.exists) return undefined;
    const durable = readImportReadiness(latest.data()?.readiness);
    if (durable) return durable;
    tx.update(batch, { readiness: migrated });
    return migrated;
  });
}
