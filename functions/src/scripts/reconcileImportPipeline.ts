import { getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import { planPipelineRecovery, type FamilyRecoverySnapshot, type IngestRecoverySnapshot, type RecoveryAction, type RecoverySnapshot } from "./pipelineRecoveryPlan";

export interface ReconcileArgs { apply: boolean; dryRun: boolean; json: boolean; allOwners: boolean; ownerId?: string }
export interface ReconcileDependencies { readSnapshot?: (ownerId?: string) => Promise<RecoverySnapshot>; applyAction?: (action: RecoveryAction, snapshot: RecoverySnapshot) => Promise<void>; log?: (value: string) => void }
type PathIdentity = { path: string; id: string; ownerId?: string };

const segment = (value: string, name: string): string => { const clean = value.trim(); if (!clean || clean === "." || clean === ".." || clean.includes("/") || clean.length > 1500) throw new Error(`invalid ${name}`); return clean; };
const ownerFromFamilyId = (id: string): string | undefined => { const divider = id.indexOf("__"); return divider > 0 ? id.slice(0, divider) : undefined; };
const familyPath = (path: string): PathIdentity | null => { const parts = path.split("/"); return parts.length === 2 && parts[0] === FAMILIES_COLLECTION ? { path, id: parts[1], ownerId: ownerFromFamilyId(parts[1]) } : null; };
const ingestPath = (path: string): PathIdentity | null => { const parts = path.split("/"); return parts.length === 4 && parts[0] === "users" && parts[2] === "ingests" ? { path, id: parts[3], ownerId: parts[1] } : null; };
const canonicalTarget = (value: string): string => { const id = segment(value, "alias target"); if (!ownerFromFamilyId(id)) throw new Error("invalid alias target"); return id; };

export const snapshotFamilyDoc = (doc: any): FamilyRecoverySnapshot => { const data = doc.data(); const identity = familyPath(doc.ref.path); if (!identity) throw new Error(`invalid family path:${doc.ref.path}`); return { ...data, id: identity.id, firestorePath: identity.path, ownerId: identity.ownerId, faceCount: Array.isArray(data.faces) ? data.faces.length : -1 }; };
export const snapshotIngestDoc = (doc: any): IngestRecoverySnapshot | null => { const identity = ingestPath(doc.ref.path); if (!identity) return null; return { ...doc.data(), ingestId: identity.id, ownerId: identity.ownerId!, firestorePath: identity.path }; };

export function parseReconcileArgs(argv: string[]): ReconcileArgs {
  let apply = false; let dryRun = false; let json = false; let allOwners = false; let ownerId: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") apply = true; else if (arg === "--dryRun") dryRun = true; else if (arg === "--json") json = true; else if (arg === "--allOwners") allOwners = true;
    else if (arg.startsWith("--ownerId=")) ownerId = segment(arg.slice(10), "ownerId");
    else if (arg === "--ownerId") { const value = argv[++index]; if (!value || value.startsWith("--")) throw new Error("missing ownerId"); ownerId = segment(value, "ownerId"); }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (apply && dryRun) throw new Error("Choose either --dryRun or --apply");
  if (apply && !ownerId && !allOwners) throw new Error("--apply requires --ownerId or --allOwners acknowledgement");
  if (apply && ownerId && allOwners) throw new Error("Choose --ownerId or --allOwners, not both");
  return { apply, dryRun, json, allOwners, ownerId };
}

async function readSnapshot(ownerId?: string): Promise<RecoverySnapshot> {
  const db = getFirestore();
  const families = (await db.collection(FAMILIES_COLLECTION).get()).docs.map(snapshotFamilyDoc).filter((family) => !ownerId || family.ownerId === ownerId);
  const ingests = (await db.collectionGroup("ingests").get()).docs.map(snapshotIngestDoc).filter((ingest): ingest is IngestRecoverySnapshot => ingest !== null && (!ownerId || ingest.ownerId === ownerId));
  return { families, ingests };
}

const auditId = (action: RecoveryAction): string => Object.values(action).join("_").replace(/[^A-Za-z0-9_-]/g, "_");
const familyOf = (snapshot: RecoverySnapshot, id: string) => snapshot.families.find((family) => family.id === id);
const familyStateMatches = (current: any, expected: FamilyRecoverySnapshot): boolean => ["status", "hidden", "aliasOf", "aliasOfId", "mergedInto", "mergedIntoId", "version"].every((key) => expected[key as keyof FamilyRecoverySnapshot] === undefined || current[key] === expected[key as keyof FamilyRecoverySnapshot]) && (expected.faceCount === undefined || (Array.isArray(current.faces) ? current.faces.length : -1) === expected.faceCount);
const ingestStateMatches = (current: any, expected: IngestRecoverySnapshot): boolean => ["analysisState", "status", "familyId", "processingId", "batchId"].every((key) => expected[key as keyof IngestRecoverySnapshot] === undefined || current[key] === expected[key as keyof IngestRecoverySnapshot]);

export async function applyRecoveryAction(action: RecoveryAction, snapshot: RecoverySnapshot, db: any = getFirestore()): Promise<void> {
  await db.runTransaction(async (tx: any) => {
    const isIngest = action.kind === "resolve_ingest";
    const expected = isIngest ? snapshot.ingests.find((ingest) => ingest.ownerId === action.ownerId && (ingest.ingestId ?? ingest.processingId) === action.ingestId) : familyOf(snapshot, action.familyId);
    if (!expected?.firestorePath) throw new Error("replan_required:missing_authoritative_path");
    const identity = isIngest ? ingestPath(expected.firestorePath) : familyPath(expected.firestorePath);
    const expectedId = isIngest ? (expected as IngestRecoverySnapshot).ingestId : (expected as FamilyRecoverySnapshot).id;
    if (!identity || identity.id !== expectedId || (isIngest ? identity.ownerId !== action.ownerId : identity.id !== action.familyId)) throw new Error("replan_required:path_identity");
    const ref = db.doc(expected.firestorePath); const audit = db.collection("pipelineRecoveryAudits").doc(auditId(action));
    const current = await tx.get(ref); const priorAudit = await tx.get(audit);
    if (priorAudit.exists) return;
    if (!current.exists || current.ref.path !== expected.firestorePath) throw new Error("replan_required:missing_current");
    if (isIngest && !ingestStateMatches(current.data(), expected as IngestRecoverySnapshot)) throw new Error("replan_required:ingest_state");
    if (!isIngest && !familyStateMatches(current.data(), expected as FamilyRecoverySnapshot)) throw new Error("replan_required:family_state");
    if (action.kind === "restore_alias") {
      const targetId = canonicalTarget(action.targetId); const sourceOwner = identity.ownerId; const targetOwner = ownerFromFamilyId(targetId);
      if (sourceOwner && sourceOwner !== targetOwner) throw new Error("invalid alias target owner");
      const target = await tx.get(db.collection(FAMILIES_COLLECTION).doc(targetId)); const targetData = target.data?.() ?? {};
      if (!target.exists || target.ref.path !== `${FAMILIES_COLLECTION}/${targetId}` || targetData.hidden === true || targetData.status === "merged" || targetData.aliasOf || targetData.aliasOfId || targetData.mergedInto || targetData.mergedIntoId) throw new Error("invalid alias target");
    }
    const update = action.kind === "quarantine_family" ? { hidden: true, status: "failed", enrichmentSubmissionRejection: { code: "invalid_family", reasons: [action.reason] } } : action.kind === "restore_alias" ? { hidden: true, status: "merged", mergedInto: action.targetId, aliasOf: action.targetId, mergedIntoId: action.targetId, aliasOfId: action.targetId, searchText: FieldValue.delete(), searchTokens: FieldValue.delete(), searchMeta: FieldValue.delete(), enrichment: FieldValue.delete(), enrichmentSubmissionRejection: FieldValue.delete(), text_vec: FieldValue.delete(), mood_vec: FieldValue.delete(), use_case_vec: FieldValue.delete(), image_vec: FieldValue.delete(), enrichmentJobId: FieldValue.delete(), enrichmentJobVersion: FieldValue.delete(), enrichmentLeaseExpiresAt: FieldValue.delete() } : action.kind === "requeue_family" ? { recoveryRequeued: true, enrichmentSubmissionRejection: FieldValue.delete() } : { analysisState: action.state, status: action.state === "complete" ? "completed" : "failed" };
    tx.set(ref, { ...update, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); tx.set(audit, { action, appliedAt: FieldValue.serverTimestamp() });
  });
}

const counts = (snapshot: RecoverySnapshot, actions: RecoveryAction[]) => ({ families: snapshot.families.length, ingests: snapshot.ingests.length, actions: actions.length });
const actionKinds = (actions: RecoveryAction[]) => actions.reduce<Record<string, number>>((result, action) => ({ ...result, [action.kind]: (result[action.kind] ?? 0) + 1 }), {});

export async function runReconcileImportPipeline(argv = process.argv.slice(2), dependencies: ReconcileDependencies = {}): Promise<void> {
  const args = parseReconcileArgs(argv); if (!dependencies.readSnapshot && !getApps().length) await import("../bootstrap/adminApp");
  const read = dependencies.readSnapshot ?? readSnapshot; const apply = dependencies.applyAction ?? ((action, snapshot) => applyRecoveryAction(action, snapshot));
  const before = await read(args.ownerId); const actions = planPipelineRecovery(before); if (args.apply) for (const action of actions) await apply(action, before);
  const after = args.apply ? await read(args.ownerId) : before; const summary = { mode: args.apply ? "apply" : "dryRun", ownerId: args.ownerId ?? null, before: counts(before, actions), actionCount: actions.length, actionKinds: actionKinds(actions), sampleActions: actions.slice(0, 20), after: counts(after, planPipelineRecovery(after)) };
  const output = args.json ? JSON.stringify(summary, null, 2) : `${summary.mode}: ${summary.actionCount} actions (${summary.after.actions} remaining)`; (dependencies.log ?? console.log)(output);
}

if (require.main === module) runReconcileImportPipeline().catch((error) => { console.error(error); process.exitCode = 1; });
