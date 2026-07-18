export interface FamilyRecoverySnapshot {
  id: string;
  firestorePath?: string;
  ownerId?: string;
  faceCount?: number;
  faces?: unknown[];
  status?: string;
  version?: number;
  hidden?: boolean;
  aliasOf?: string;
  aliasOfId?: string;
  mergedInto?: string;
  mergedIntoId?: string;
  canonicalMerge?: { targetSlug?: string };
  enrichment?: unknown;
  enrichmentSubmissionRejection?: { code?: string; reasons?: string[] };
  recoveryRequeued?: boolean;
}

export interface IngestRecoverySnapshot {
  ownerId: string;
  firestorePath?: string;
  ingestId?: string;
  processingId?: string;
  familyId?: string;
  analysisState?: string;
  status?: string;
  batchId?: string;
}

export interface RecoverySnapshot {
  families: FamilyRecoverySnapshot[];
  ingests: IngestRecoverySnapshot[];
}

export type RecoveryAction =
  | { kind: "quarantine_family"; familyId: string; reason: string }
  | { kind: "restore_alias"; familyId: string; targetId: string }
  | { kind: "resolve_ingest"; ownerId: string; ingestId: string; state: "complete" | "failed" }
  | { kind: "requeue_family"; familyId: string; version: number };

const validDocId = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 1500 && !value.includes("/") && value !== "." && value !== "..";
const ownerFromFamilyId = (value: string): string | undefined => { const divider = value.indexOf("__"); return divider > 0 ? value.slice(0, divider) : undefined; };
const aliasTarget = (family: FamilyRecoverySnapshot): string | undefined =>
  (() => {
    const target = [family.aliasOfId, family.aliasOf, family.mergedIntoId, family.mergedInto, family.canonicalMerge?.targetSlug].find(validDocId)?.trim();
    if (!target || !family.ownerId) return undefined;
    const targetOwner = ownerFromFamilyId(target);
    if (targetOwner) return targetOwner === family.ownerId ? target : undefined;
    return `${family.ownerId}__${target}`;
  })();

const invalidReasons = (family: FamilyRecoverySnapshot): string[] => [
  !family.ownerId ? "missing_owner" : undefined,
  !Array.isArray(family.faces) || family.faces.length === 0 ? "missing_faces" : undefined,
].filter((reason): reason is string => Boolean(reason));

const terminalIngestState = (
  ingest: IngestRecoverySnapshot,
  families: Map<string, FamilyRecoverySnapshot>,
): "complete" | "failed" | undefined => {
  if (!ingest.ingestId && !ingest.processingId) return undefined;
  if (!["analyzing", "enriching"].includes(ingest.analysisState ?? "")) return undefined;
  const family = ingest.familyId ? families.get(ingest.familyId) : undefined;
  if (!family || family.status === "failed" || family.enrichmentSubmissionRejection) return "failed";
  return ["ready", "enriched"].includes(family.status ?? "") || family.enrichment ? "complete" : undefined;
};

export function planPipelineRecovery(snapshot: RecoverySnapshot): RecoveryAction[] {
  const actions: RecoveryAction[] = [];
  const families = new Map(snapshot.families.map((family) => [family.id, family]));
  for (const family of snapshot.families) {
    const target = aliasTarget(family);
    if (family.hidden && target && family.status !== "merged") {
      actions.push({ kind: "restore_alias", familyId: family.id, targetId: target });
      continue;
    }
    const reasons = invalidReasons(family);
    if (reasons.length && family.status === "ready" && (!Array.isArray(family.faces) || family.faces.length === 0)) {
      actions.push({ kind: "quarantine_family", familyId: family.id, reason: reasons.map((reason) => reason === "missing_faces" ? "faces" : reason).join("_and_") });
    } else if (family.status === "ready" && !family.recoveryRequeued) {
      actions.push({ kind: "requeue_family", familyId: family.id, version: family.version ?? 0 });
    }
  }
  for (const ingest of snapshot.ingests) {
    const state = terminalIngestState(ingest, families);
    const ingestId = ingest.ingestId ?? ingest.processingId;
    if (state && ingestId) actions.push({ kind: "resolve_ingest", ownerId: ingest.ownerId, ingestId, state });
  }
  return actions;
}
