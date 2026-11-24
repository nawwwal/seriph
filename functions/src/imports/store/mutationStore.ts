import type { Firestore, Transaction } from "firebase-admin/firestore";
import { catalogFamilyDocId } from "../../storage/catalogIdentity";
import { coverFaceFor } from "../../storage/shelfSummary";
import type { FontFace, FontFamilyDoc } from "../../models/catalog.models";
import type { FontAsset } from "../../models/catalog.assets";
import { assetClaimRef, leaseDate } from "./assetClaimStore";
import type { ImportPlan, PlanFamily, PlanFace } from "../planning/buildPlan";
import { importBatchRef } from "./paths";
import type { WrittenPlannedAsset } from "../apply/writePlannedAssets";
import { writeEnrichmentJob, type EnrichmentJobCommitInput } from "../../enrichment/jobs/jobStore";
import { assetSizeBytes, faceFieldsFromAssets, familyFieldsFromClaims } from "./mutationMetadata";

export type MutationCommitResult =
  | { kind: "committed"; familyVersion: number; mutationId: string }
  | { kind: "already_applied"; familyVersion: number }
  | { kind: "replan_required"; expectedVersion: number; actualVersion: number }
  | { kind: "canceled" };
export interface MutationCommitInput {
  db: Firestore; plan: ImportPlan; familyId: string; expectedVersion: number; mutationId: string;
  assets: readonly WrittenPlannedAsset[]; claims: readonly WrittenPlannedAsset["source"][]; now: Date;
  enrichmentJob: EnrichmentJobCommitInput;
}

const familyRef = (db: Firestore, ownerId: string, slug: string) =>
  db.collection("fontfamilies").doc(catalogFamilyDocId(ownerId, slug));

const flatAsset = (asset: WrittenPlannedAsset): FontAsset => ({
  id: asset.assetId, contentHash: asset.sha256,
  containerFormat: asset.format as FontAsset["containerFormat"],
  technology: asset.source.fontMetadata?.isVariable ? "Variable" : (asset.format as FontAsset["technology"]),
  originalName: asset.originalName, original: { storagePath: asset.originalPath, url: asset.originalUrl },
  served: { storagePath: asset.servedPath, url: asset.servedUrl },
  source: { batchId: asset.source.batchId, sourceId: asset.source.sourceId ?? "", itemId: asset.source.itemId, originalPath: asset.source.sourcePath ?? "" },
});

function mergeFace(existing: FontFace | undefined, face: PlanFace, planned: readonly WrittenPlannedAsset[]): FontFace {
  const assets = planned.map(flatAsset);
  const merged = [...(existing?.assets ?? []), ...assets].filter((asset, index, all) => all.findIndex((item) => item.id === asset.id) === index);
  const preferred = [...merged].sort((a, b) => Number(b.containerFormat === "WOFF2") - Number(a.containerFormat === "WOFF2") || a.id.localeCompare(b.id))[0];
  const extra = faceFieldsFromAssets(planned, existing);
  return {
    ...(existing ?? {}), id: existing?.id ?? face.logicalFaceKey, styleName: face.styleName, weight: face.weight,
    weightName: face.styleName, width: face.width, italic: face.italic,
    isVariable: extra.isVariable ?? false,
    ...(extra.axes ? { axes: extra.axes } : {}),
    ...(extra.meta ? { meta: extra.meta } : {}),
    ...(extra.postScriptName ? { postScriptName: extra.postScriptName } : {}),
    ...(extra.fullName ? { fullName: extra.fullName } : {}),
    format: preferred?.containerFormat ?? "OTF",
    fileSize: assetSizeBytes(planned, preferred, existing),
    filename: preferred?.originalName ?? existing?.filename ?? face.logicalFaceKey,
    woff2: preferred?.served ?? existing?.woff2 ?? { storagePath: "", url: "" },
    original: preferred?.original ?? existing?.original ?? { storagePath: "", url: "" },
    contentHash: preferred?.contentHash ?? existing?.contentHash, assets: merged, preferredAssetId: preferred?.id,
  };
}

function mergeFamily(existing: FontFamilyDoc | undefined, family: PlanFamily, ownerId: string, docId: string, assets: readonly WrittenPlannedAsset[], version: number, now: Date): FontFamilyDoc {
  const incoming = new Map<string, WrittenPlannedAsset[]>();
  assets.forEach((asset) => incoming.set(asset.assetId, [asset]));
  const faces = [...(existing?.faces ?? [])];
  for (const planFace of family.faces) {
    const additions = planFace.assets.flatMap((asset) => incoming.get(asset.assetId) ?? []);
    const index = faces.findIndex((face) => face.id === planFace.logicalFaceKey);
    const next = mergeFace(index >= 0 ? faces[index] : undefined, planFace, additions);
    if (index >= 0) faces[index] = next; else faces.push(next);
  }
  faces.sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic) || a.id.localeCompare(b.id));
  const extra = familyFieldsFromClaims(existing, assets, faces, now);
  const base = existing ?? {
    id: docId, slug: family.familySlug, name: family.familyName, fileBase: family.familySlug,
    category: extra.category ?? ("SANS_SERIF" as const), faces: [], status: "ready" as const, version: 0,
  };
  const coverFaceId = coverFaceFor(faces)?.id;
  return {
    ...base, ...extra, name: base.name || family.familyName, faces, styleCount: faces.length, coverFaceId,
    coverFace: coverFaceFor(faces, coverFaceId), hidden: false, ownerId: base.ownerId ?? ownerId, status: "ready", version, updatedAt: now,
  };
}

async function resolveAliasTargetInTx(tx: Transaction, db: Firestore, ownerId: string, initialRef: ReturnType<typeof familyRef>, initialSnap: FirebaseFirestore.DocumentSnapshot) {
  let ref = initialRef;
  let snap = initialSnap;
  const visited = new Set<string>([ref.id]);
  for (let hop = 0; hop < 5; hop++) {
    const data = snap.data() as Record<string, unknown> | undefined;
    const aliasTarget = typeof data?.mergedInto === "string" ? data.mergedInto : typeof data?.aliasOf === "string" ? data.aliasOf : null;
    if (!snap.exists || !data || (!aliasTarget && data.hidden !== true && data.status !== "merged")) break;
    if (!aliasTarget) break;
    const nextRef = familyRef(db, ownerId, aliasTarget);
    if (visited.has(nextRef.id)) break;
    visited.add(nextRef.id);
    const nextSnap = await tx.get(nextRef);
    if (!nextSnap.exists) break;
    ref = nextRef;
    snap = nextSnap;
  }
  return { ref, snap };
}

const claimRecord = (claim: WrittenPlannedAsset["source"]) => {
  const { bytes: _bytes, ...record } = claim;
  return record;
};

export async function commitFamilyMutation(input: MutationCommitInput): Promise<MutationCommitResult> {
  const family = input.plan.families.find((entry) => entry.familyId === input.familyId);
  if (!family) throw new Error("family missing from plan");
  const batch = importBatchRef(input.db, input.plan.ownerId, input.plan.batchId);
  const initialFamilyDoc = familyRef(input.db, input.plan.ownerId, family.familySlug);
  const mutation = batch.collection("mutations").doc(input.mutationId);
  const task = batch.collection("plans").doc(String(input.plan.planVersion)).collection("applyTasks").doc(input.familyId);
  const plan = batch.collection("plans").doc(String(input.plan.planVersion));
  return input.db.runTransaction(async (tx) => {
    const claimRefs = input.claims.map((claim) => assetClaimRef(input.db, claim.ownerId, claim.sha256));
    const [prior, currentInitial, taskSnap, planSnap, batchSnap, ...claimSnaps] = await Promise.all([tx.get(mutation), tx.get(initialFamilyDoc), tx.get(task), tx.get(plan), tx.get(batch), ...claimRefs.map((ref) => tx.get(ref))]);
    if (prior.exists) return { kind: "already_applied", familyVersion: prior.data()?.familyVersion };
    if (batchSnap.exists && batchSnap.data()?.outcome === "canceled") return { kind: "canceled" };
    const { ref: familyDoc, snap: current } = await resolveAliasTargetInTx(tx, input.db, input.plan.ownerId, initialFamilyDoc, currentInitial);
    const actualVersion = current.exists ? Number(current.data()?.version ?? 0) : 0;
    if (actualVersion !== input.expectedVersion) {
      const result = { kind: "replan_required" as const, expectedVersion: input.expectedVersion, actualVersion };
      tx.set(task, { ...(taskSnap.exists ? taskSnap.data() : {}), status: "replan_required", result, updatedAt: input.now });
      tx.set(plan, { ...(planSnap.exists ? planSnap.data() : {}), state: "partial", application: { ...result, familyId: input.familyId, updatedAt: input.now }, updatedAt: input.now });
      return result;
    }
    input.claims.forEach((claim, index) => {
      const snapshot = claimSnaps[index]; const data = snapshot?.exists ? snapshot.data() : undefined;
      const expires = leaseDate(data?.leaseExpiresAt);
      if (!data || data.status !== "leased" || !expires || expires <= input.now || data.claimId !== (claim.claimId ?? `${claim.batchId}:${claim.itemId}`)) throw new Error("asset claim is not leased");
    });
    const nextVersion = actualVersion + 1;
    const targetSlug = (current.exists && typeof current.data()?.slug === "string" ? String(current.data()?.slug) : family.familySlug);
    const nextFamily = mergeFamily(current.exists ? current.data() as FontFamilyDoc : undefined, family, input.plan.ownerId, familyDoc.id, input.assets, nextVersion, input.now);
    const applied = new Set<string>(planSnap.data()?.appliedFamilyIds ?? []); applied.add(input.familyId);
    const cleanIds = input.plan.families.filter((entry) => entry.clean).map((entry) => entry.familyId);
    await writeEnrichmentJob(tx, input.db, { ...input.enrichmentJob, familyId: targetSlug, familyVersion: nextVersion, now: input.now });
    tx.set(familyDoc, nextFamily);
    tx.set(mutation, { mutationId: input.mutationId, familyId: input.familyId, familySlug: targetSlug, familyVersion: nextVersion, planVersion: input.plan.planVersion, status: "applied", createdAt: input.now });
    input.claims.forEach((claim, index) => tx.set(claimRefs[index]!, { ...claimRecord(claim), status: "committed", updatedAt: input.now }));
    tx.set(task, { ...(taskSnap.exists ? taskSnap.data() : {}), status: "applied", result: { kind: "applied", familyVersion: nextVersion }, updatedAt: input.now });
    tx.set(plan, { ...(planSnap.exists ? planSnap.data() : {}), state: cleanIds.every((id) => applied.has(id)) ? "applied" : "applying", appliedFamilyIds: [...applied], updatedAt: input.now });
    return { kind: "committed", familyVersion: nextVersion, mutationId: input.mutationId };
  });
}
