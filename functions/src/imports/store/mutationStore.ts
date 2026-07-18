import type { Firestore } from "firebase-admin/firestore";
import { catalogFamilyDocId } from "../../storage/catalogIdentity";
import { coverFaceFor } from "../../storage/shelfSummary";
import type { FontFace, FontFamilyDoc } from "../../models/catalog.models";
import type { FontAsset } from "../../models/catalog.assets";
import { assetClaimRef } from "./assetClaimStore";
import type { ImportPlan, PlanFamily, PlanFace } from "../planning/buildPlan";
import { importBatchRef } from "./paths";
import type { WrittenPlannedAsset } from "../apply/writePlannedAssets";

export type MutationCommitResult =
  | { kind: "committed"; familyVersion: number; mutationId: string }
  | { kind: "already_applied"; familyVersion: number }
  | { kind: "replan_required"; expectedVersion: number; actualVersion: number };
export interface MutationCommitInput {
  db: Firestore; plan: ImportPlan; familyId: string; expectedVersion: number; mutationId: string;
  assets: readonly WrittenPlannedAsset[]; claims: readonly WrittenPlannedAsset["source"][]; now: Date; enrichmentJobId: string;
}

const familyRef = (db: Firestore, ownerId: string, family: PlanFamily) =>
  db.collection("fontfamilies").doc(catalogFamilyDocId(ownerId, family.familySlug));
const flatAsset = (asset: WrittenPlannedAsset): FontAsset => ({ id: asset.assetId, contentHash: asset.sha256,
  containerFormat: asset.format as FontAsset["containerFormat"], technology: asset.format as FontAsset["technology"],
  originalName: asset.originalName, original: { storagePath: asset.originalPath, url: `/${asset.originalPath}` },
  served: { storagePath: asset.servedPath, url: `/${asset.servedPath}` },
  source: { batchId: asset.source.batchId, sourceId: "", itemId: asset.source.itemId, originalPath: asset.source.sourcePath ?? "" } });
function mergeFace(existing: FontFace | undefined, face: PlanFace, assets: FontAsset[]): FontFace {
  const merged = [...(existing?.assets ?? []), ...assets].filter((asset, index, all) => all.findIndex((item) => item.id === asset.id) === index);
  const preferred = [...merged].sort((a, b) => Number(b.containerFormat === "WOFF2") - Number(a.containerFormat === "WOFF2") || a.id.localeCompare(b.id))[0];
  return { ...(existing ?? {}), id: existing?.id ?? face.logicalFaceKey, styleName: face.styleName, weight: face.weight,
    weightName: face.styleName, width: face.width, italic: face.italic, isVariable: false, format: preferred?.containerFormat ?? "OTF",
    fileSize: preferred?.contentHash ? assets.find((asset) => asset.contentHash === preferred.contentHash) ? 0 : existing?.fileSize ?? 0 : existing?.fileSize ?? 0,
    filename: preferred?.originalName ?? existing?.filename ?? face.logicalFaceKey, woff2: preferred?.served ?? existing?.woff2 ?? { storagePath: "", url: "" },
    original: preferred?.original ?? existing?.original ?? { storagePath: "", url: "" }, contentHash: preferred?.contentHash ?? existing?.contentHash, assets: merged, preferredAssetId: preferred?.id };
}
function mergeFamily(existing: FontFamilyDoc | undefined, family: PlanFamily, ownerId: string, docId: string, assets: readonly WrittenPlannedAsset[], version: number, now: Date): FontFamilyDoc {
  const incoming = new Map<string, FontAsset[]>(); assets.forEach((asset) => incoming.set(asset.assetId, [flatAsset(asset)]));
  const faces = [...(existing?.faces ?? [])];
  for (const planFace of family.faces) {
    const additions = planFace.assets.flatMap((asset) => incoming.get(asset.assetId) ?? []);
    const index = faces.findIndex((face) => face.id === planFace.logicalFaceKey);
    const next = mergeFace(index >= 0 ? faces[index] : undefined, planFace, additions);
    if (index >= 0) faces[index] = next; else faces.push(next);
  }
  faces.sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic) || a.id.localeCompare(b.id));
  const base = existing ?? { id: docId, slug: family.familySlug, name: family.familyName, fileBase: family.familySlug,
    category: "SANS_SERIF" as const, faces: [], status: "ready" as const, version: 0 };
  const coverFaceId = coverFaceFor(faces)?.id;
  return { ...base, name: base.name || family.familyName, faces, styleCount: faces.length, coverFaceId,
    coverFace: coverFaceFor(faces, coverFaceId), hidden: false, ownerId: base.ownerId ?? ownerId, status: "ready", version, updatedAt: now };
}

export async function commitFamilyMutation(input: MutationCommitInput): Promise<MutationCommitResult> {
  const family = input.plan.families.find((entry) => entry.familyId === input.familyId);
  if (!family) throw new Error("family missing from plan");
  const familyDocId = catalogFamilyDocId(input.plan.ownerId, family.familySlug);
  const batch = importBatchRef(input.db, input.plan.ownerId, input.plan.batchId);
  const familyDoc = familyRef(input.db, input.plan.ownerId, family);
  const mutation = batch.collection("mutations").doc(input.mutationId);
  const task = batch.collection("plans").doc(String(input.plan.planVersion)).collection("applyTasks").doc(input.familyId);
  const plan = batch.collection("plans").doc(String(input.plan.planVersion));
  const enrichment = batch.collection("enrichmentJobs").doc(input.enrichmentJobId);
  return input.db.runTransaction(async (tx) => {
    const claimRefs = input.claims.map((claim) => assetClaimRef(input.db, claim.ownerId, claim.sha256));
    const [prior, current, taskSnap, planSnap, ...claimSnaps] = await Promise.all([tx.get(mutation), tx.get(familyDoc), tx.get(task), tx.get(plan), ...claimRefs.map((ref) => tx.get(ref))]);
    if (prior.exists) return { kind: "already_applied", familyVersion: prior.data()?.familyVersion };
    const actualVersion = current.exists ? Number(current.data()?.version ?? 0) : 0;
    if (actualVersion !== input.expectedVersion) return { kind: "replan_required", expectedVersion: input.expectedVersion, actualVersion };
    input.claims.forEach((claim, index) => {
      const snapshot = claimSnaps[index]; const data = snapshot?.exists ? snapshot.data() : undefined;
      if (!data || data.status !== "leased" || data.claimId !== (claim.claimId ?? `${claim.batchId}:${claim.itemId}`)) throw new Error("asset claim is not leased");
    });
    const nextVersion = actualVersion + 1;
    const nextFamily = mergeFamily(current.exists ? current.data() as FontFamilyDoc : undefined, family, input.plan.ownerId, familyDocId, input.assets, nextVersion, input.now);
    const applied = new Set<string>(planSnap.data()?.appliedFamilyIds ?? []); applied.add(input.familyId);
    const cleanIds = input.plan.families.filter((entry) => entry.clean).map((entry) => entry.familyId);
    tx.set(familyDoc, nextFamily); tx.set(mutation, { mutationId: input.mutationId, familyId: input.familyId, familyVersion: nextVersion, planVersion: input.plan.planVersion, status: "applied", createdAt: input.now });
    input.claims.forEach((claim, index) => tx.set(claimRefs[index]!, { ...claim, status: "committed", updatedAt: input.now }));
    tx.set(enrichment, { jobId: input.enrichmentJobId, familyId: input.familyId, familyVersion: nextVersion, status: "queued", createdAt: input.now });
    tx.set(task, { ...(taskSnap.exists ? taskSnap.data() : {}), status: "applied", result: { kind: "applied", familyVersion: nextVersion }, updatedAt: input.now });
    tx.set(plan, { ...(planSnap.exists ? planSnap.data() : {}), state: cleanIds.every((id) => applied.has(id)) ? "applied" : "applying", appliedFamilyIds: [...applied], updatedAt: input.now });
    return { kind: "committed", familyVersion: nextVersion, mutationId: input.mutationId };
  });
}
