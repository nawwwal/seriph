export type RollbackResult =
  | { kind: "rolled_back"; familyVersion: number }
  | { kind: "review_required" }
  | { kind: "already_rolled_back" };
export interface RollbackMutation { mutationId: string; familyId: string; familyVersion: number; status?: string; introducedAssetIds?: readonly string[]; assets?: readonly { id?: string }[] }
export interface RollbackFamily { id?: string; version: number; faces?: readonly { assets?: readonly { id?: string }[] }[] }
export interface RollbackDependencies {
  deleteAsset(assetId: string): Promise<void>;
  createReviewItem(input: { mutationId: string; familyId: string; reasonCode: "rollback_version_conflict" }): Promise<void>;
  assetSolelyIntroduced?(assetId: string, mutation: RollbackMutation, family: RollbackFamily): Promise<boolean>;
  updateFamily?(input: { familyId: string; removeAssetIds: readonly string[] }): Promise<void>;
  markMutation?(input: { mutationId: string; status: "rolled_back" }): Promise<void>;
}

const mutationAssets = (mutation: RollbackMutation): string[] => [...new Set(
  mutation.introducedAssetIds?.filter((id) => typeof id === "string" && id.trim()) ?? mutation.assets?.flatMap((asset) => asset.id ? [asset.id] : []) ?? [],
)];

export async function rollbackMutation(
  mutation: RollbackMutation, family: RollbackFamily, deps: RollbackDependencies,
): Promise<RollbackResult> {
  if (mutation.status === "rolled_back") return { kind: "already_rolled_back" };
  if (family.id !== undefined && family.id !== mutation.familyId || family.version !== mutation.familyVersion) {
    await deps.createReviewItem({ mutationId: mutation.mutationId, familyId: mutation.familyId, reasonCode: "rollback_version_conflict" });
    return { kind: "review_required" };
  }
  const candidates = mutationAssets(mutation);
  const assetIds: string[] = [];
  for (const assetId of candidates) if (!deps.assetSolelyIntroduced || await deps.assetSolelyIntroduced(assetId, mutation, family)) assetIds.push(assetId);
  for (const assetId of assetIds) await deps.deleteAsset(assetId);
  await deps.updateFamily?.({ familyId: mutation.familyId, removeAssetIds: assetIds });
  await deps.markMutation?.({ mutationId: mutation.mutationId, status: "rolled_back" });
  return { kind: "rolled_back", familyVersion: family.version };
}
