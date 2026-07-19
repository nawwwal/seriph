import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { catalogFamilyDocId } from "../../storage/catalogIdentity";
import { importBatchRef } from "../store/paths";

export type RollbackResult =
  | { kind: "rolled_back"; familyVersion: number }
  | { kind: "review_required" }
  | { kind: "already_rolled_back" };
export interface RollbackMutation { mutationId: string; familyId: string; familyVersion: number; status?: string; introducedAssetIds?: readonly string[]; assets?: readonly { id?: string }[] }
export interface RollbackFamily { id?: string; version: number; faces?: readonly { assets?: readonly { id?: string }[] }[] }
export type RollbackCasResult = { kind: "rolled_back" | "already_rolled_back" | "conflict" };
export interface RollbackDependencies {
  deleteAsset(assetId: string): Promise<void>;
  createReviewItem(input: { mutationId: string; familyId: string; reasonCode: "rollback_version_conflict" | "rollback_asset_ownership_unproven" }): Promise<void>;
  assetSolelyIntroduced(assetId: string, mutation: RollbackMutation, family: RollbackFamily): Promise<boolean>;
  compareAndSetRollback(input: { mutationId: string; familyId: string; expectedFamilyVersion: number; removeAssetIds: readonly string[] }): Promise<RollbackCasResult>;
}

const mutationAssets = (mutation: RollbackMutation): string[] => [...new Set(
  mutation.introducedAssetIds?.filter((id) => typeof id === "string" && id.trim()) ?? mutation.assets?.flatMap((asset) => asset.id ? [asset.id] : []) ?? [],
)];

export async function rollbackMutation(
  mutation: RollbackMutation, family: RollbackFamily, deps: RollbackDependencies,
): Promise<RollbackResult> {
  if (mutation.status === "rolled_back") return { kind: "already_rolled_back" };
  if (family.id !== mutation.familyId || family.version !== mutation.familyVersion) {
    await deps.createReviewItem({ mutationId: mutation.mutationId, familyId: mutation.familyId, reasonCode: "rollback_version_conflict" });
    return { kind: "review_required" };
  }
  const candidates = mutationAssets(mutation);
  const assetIds: string[] = [];
  for (const assetId of candidates) {
    if (!await deps.assetSolelyIntroduced(assetId, mutation, family)) {
      await deps.createReviewItem({ mutationId: mutation.mutationId, familyId: mutation.familyId, reasonCode: "rollback_asset_ownership_unproven" });
      return { kind: "review_required" };
    }
    assetIds.push(assetId);
  }
  const cas = await deps.compareAndSetRollback({ mutationId: mutation.mutationId, familyId: mutation.familyId, expectedFamilyVersion: mutation.familyVersion, removeAssetIds: assetIds });
  if (cas.kind === "already_rolled_back") return { kind: "already_rolled_back" };
  if (cas.kind === "conflict") {
    await deps.createReviewItem({ mutationId: mutation.mutationId, familyId: mutation.familyId, reasonCode: "rollback_version_conflict" });
    return { kind: "review_required" };
  }
  for (const assetId of assetIds) await deps.deleteAsset(assetId);
  return { kind: "rolled_back", familyVersion: family.version };
}

function withoutAssets(family: Record<string, unknown>, assetIds: readonly string[]): Record<string, unknown> {
  const remove = new Set(assetIds); const faces = Array.isArray(family.faces) ? family.faces : [];
  return { ...family, faces: faces.map((face) => ({ ...(face as Record<string, unknown>), assets: Array.isArray((face as Record<string, unknown>).assets)
    ? ((face as Record<string, unknown>).assets as unknown[]).filter((asset) => !remove.has(String((asset as Record<string, unknown>).id ?? ""))) : (face as Record<string, unknown>).assets })) };
}

export function firestoreRollbackDependencies(db: Firestore, ownerId: string, batchId: string): Pick<RollbackDependencies, "compareAndSetRollback"> {
  return { compareAndSetRollback: async (input) => db.runTransaction(async (tx) => {
    const mutationRef = importBatchRef(db, ownerId, batchId).collection("mutations").doc(input.mutationId);
    const familyRef = db.collection("fontfamilies").doc(catalogFamilyDocId(ownerId, input.familyId));
    const [mutation, family] = await Promise.all([tx.get(mutationRef), tx.get(familyRef)]);
    const mutationData = mutation.data(); const familyData = family.data();
    const familyIdentity = familyData?.familyId ?? familyData?.slug ?? familyData?.id;
    const exactFamily = familyIdentity === undefined || familyIdentity === input.familyId || familyIdentity === familyRef.id;
    if (!mutation.exists || !family.exists || !exactFamily || mutationData?.familyId !== input.familyId || mutationData?.familyVersion !== input.expectedFamilyVersion || familyData?.version !== input.expectedFamilyVersion) return { kind: "conflict" };
    if (mutationData.status === "rolled_back") return { kind: "already_rolled_back" };
    tx.update(familyRef, { ...withoutAssets(familyData, input.removeAssetIds), updatedAt: FieldValue.serverTimestamp() });
    tx.update(mutationRef, { status: "rolled_back", rolledBackAt: FieldValue.serverTimestamp() });
    return { kind: "rolled_back" };
  }) };
}
