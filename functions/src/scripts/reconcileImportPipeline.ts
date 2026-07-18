import { getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import { planPipelineRecovery, type RecoveryAction, type RecoverySnapshot } from "./pipelineRecoveryPlan";

type Args = { apply: boolean; json: boolean; ownerId?: string };
const parseArgs = (argv: string[]): Args => {
  let apply = false; let dryRun = false; let json = false; let ownerId: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") apply = true;
    else if (arg === "--dryRun") dryRun = true;
    else if (arg === "--json") json = true;
    else if (arg.startsWith("--ownerId=")) ownerId = arg.slice(10);
    else if (arg === "--ownerId") ownerId = argv[++index];
  }
  if (apply && dryRun) throw new Error("Choose either --dryRun or --apply");
  return { apply, json, ownerId };
};

async function readSnapshot(ownerId?: string): Promise<RecoverySnapshot> {
  const db = getFirestore();
  let familyQuery = db.collection(FAMILIES_COLLECTION) as any;
  if (ownerId) familyQuery = familyQuery.where("ownerId", "==", ownerId);
  const families = (await familyQuery.get()).docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  const ingestQuery = ownerId
    ? db.collection("users").doc(ownerId).collection("ingests")
    : db.collectionGroup("ingests");
  const ingests = (await ingestQuery.get()).docs.map((doc: any) => ({
    ...doc.data(), ingestId: doc.id, ownerId: doc.data().ownerId ?? doc.ref.parent.parent?.id,
  }));
  return { families, ingests };
}

const auditId = (action: RecoveryAction): string => Object.values(action).join("_").replace(/[^A-Za-z0-9_-]/g, "_");
const familyOf = (snapshot: RecoverySnapshot, id: string) => snapshot.families.find((family) => family.id === id);

async function applyAction(action: RecoveryAction, snapshot: RecoverySnapshot): Promise<void> {
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const isFamily = action.kind !== "resolve_ingest";
    const ref = isFamily
      ? db.collection(FAMILIES_COLLECTION).doc(action.familyId)
      : db.collection("users").doc(action.ownerId).collection("ingests").doc(action.ingestId);
    const audit = db.collection("pipelineRecoveryAudits").doc(auditId(action));
    const current = await tx.get(ref); const priorAudit = await tx.get(audit);
    if (priorAudit.exists) return;
    if (!current.exists) throw new Error(`replan_required:${audit.id}`);
    if (action.kind === "resolve_ingest") {
      const expected = snapshot.ingests.find((ingest) => (ingest.ingestId ?? ingest.processingId) === action.ingestId && ingest.ownerId === action.ownerId);
      if (!expected || current.data()?.analysisState !== expected.analysisState) throw new Error(`replan_required:${audit.id}`);
    } else {
      const expected = familyOf(snapshot, action.familyId);
      if (!expected || (expected.version !== undefined && current.data()?.version !== expected.version)) throw new Error(`replan_required:${audit.id}`);
    }
    const update = action.kind === "quarantine_family"
      ? { hidden: true, status: "failed", enrichmentSubmissionRejection: { code: "invalid_family", reasons: [action.reason] } }
      : action.kind === "restore_alias"
        ? { hidden: true, status: "merged", mergedInto: action.targetId, aliasOf: action.targetId, mergedIntoId: action.targetId, aliasOfId: action.targetId, searchText: FieldValue.delete(), searchTokens: FieldValue.delete(), searchMeta: FieldValue.delete(), enrichment: FieldValue.delete(), enrichmentSubmissionRejection: FieldValue.delete(), text_vec: FieldValue.delete(), mood_vec: FieldValue.delete(), use_case_vec: FieldValue.delete(), image_vec: FieldValue.delete(), enrichmentJobId: FieldValue.delete(), enrichmentJobVersion: FieldValue.delete(), enrichmentLeaseExpiresAt: FieldValue.delete() }
        : action.kind === "requeue_family"
          ? { recoveryRequeued: true, enrichmentSubmissionRejection: FieldValue.delete() }
          : { analysisState: action.state, status: action.state === "complete" ? "completed" : "failed" };
    tx.set(ref, { ...update, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(audit, { action, appliedAt: FieldValue.serverTimestamp() });
  });
}

const counts = (snapshot: RecoverySnapshot, actions: RecoveryAction[]) => ({ families: snapshot.families.length, ingests: snapshot.ingests.length, actions: actions.length });
const actionKinds = (actions: RecoveryAction[]) => actions.reduce<Record<string, number>>((result, action) => ({ ...result, [action.kind]: (result[action.kind] ?? 0) + 1 }), {});

export async function runReconcileImportPipeline(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  if (!getApps().length) await import("../bootstrap/adminApp");
  const before = await readSnapshot(args.ownerId); const actions = planPipelineRecovery(before);
  if (args.apply) for (const action of actions) await applyAction(action, before);
  const after = args.apply ? await readSnapshot(args.ownerId) : before;
  const summary = { mode: args.apply ? "apply" : "dryRun", ownerId: args.ownerId ?? null, before: counts(before, actions), actionCount: actions.length, actionKinds: actionKinds(actions), sampleActions: actions.slice(0, 20), after: counts(after, planPipelineRecovery(after)) };
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else console.log(`${summary.mode}: ${summary.actionCount} actions (${summary.after.actions} remaining)`);
}

if (require.main === module) runReconcileImportPipeline().catch((error) => { console.error(error); process.exitCode = 1; });
