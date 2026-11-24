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

/** Migrate old batches once transactionally so concurrent discoveries never lose decrements. */
export async function ensureImportReadiness(db: Firestore, batch: ReturnType<typeof importBatchRef>): Promise<ImportReadiness | undefined> {
  const current = await batch.get();
  if (!current.exists) return undefined;
  const existing = readImportReadiness(current.data()?.readiness);
  if (existing) return existing;
  return db.runTransaction(async (tx) => {
    const [latest, sourceSnap, itemSnap] = await Promise.all([
      tx.get(batch),
      tx.get(batch.collection("sources")),
      tx.get(batch.collection("items")),
    ]);
    if (!latest.exists) return undefined;
    const durable = readImportReadiness(latest.data()?.readiness);
    if (durable) return durable;
    const migrated = readinessFromRows(sourceSnap.docs.map((doc) => doc.data() as Row), itemSnap.docs.map((doc) => doc.data() as Row));
    tx.update(batch, { readiness: migrated });
    return migrated;
  });
}
