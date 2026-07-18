import type { Bucket } from "@google-cloud/storage";
import type { PlanAsset } from "../planning/buildPlan";
import type { AssetClaimInput } from "../store/assetClaimStore";

export interface PlannedAssetClaim extends AssetClaimInput { bytes?: Buffer; sourcePath?: string; originalName?: string; }
export interface WrittenPlannedAsset extends PlanAsset {
  originalPath: string; servedPath: string; originalName: string; bytes: Buffer; source: PlannedAssetClaim;
}
export interface WritePlannedAssetsDependencies {
  bucket?: Pick<Bucket, "file">;
  read?: (claim: PlannedAssetClaim) => Promise<Buffer>;
  write?: (artifact: WrittenPlannedAsset) => Promise<void>;
  prefix?: string;
}

const safe = (value: string, field: string): string => {
  if (!value || value.includes("/")) throw new Error(`invalid ${field}`);
  return value;
};
const extension = (format: string): string => format.replace(/^\./, "").toLowerCase();
const pathFor = (prefix: string, ownerId: string, hash: string, format: string, kind: string): string =>
  `${prefix}/${safe(ownerId, "ownerId")}/${hash}/${kind}.${extension(format)}`;

async function persist(artifact: WrittenPlannedAsset, deps: WritePlannedAssetsDependencies): Promise<void> {
  if (deps.write) return deps.write(artifact);
  if (!deps.bucket) throw new Error("asset writer requires a bucket or write dependency");
  await deps.bucket.file(artifact.originalPath).save(artifact.bytes, { resumable: false });
  await deps.bucket.file(artifact.servedPath).save(artifact.bytes, { resumable: false });
}

export async function writePlannedAssets(input: {
  ownerId: string; familyId: string; assets: readonly PlanAsset[]; claims: readonly PlannedAssetClaim[];
}, deps: WritePlannedAssetsDependencies = {}): Promise<WrittenPlannedAsset[]> {
  const claims = new Map(input.claims.map((claim) => [claim.assetId, claim]));
  const written = new Map<string, WrittenPlannedAsset>();
  for (const asset of input.assets) {
    const claim = claims.get(asset.assetId);
    if (!claim || claim.sha256 !== asset.sha256) throw new Error(`missing leased claim for ${asset.assetId}`);
    const prior = written.get(asset.sha256);
    if (prior) continue;
    const bytes = claim.bytes ?? (deps.read ? await deps.read(claim) : undefined);
    if (!bytes) throw new Error(`missing source bytes for ${asset.assetId}`);
    const prefix = deps.prefix ?? "font-assets";
    const artifact: WrittenPlannedAsset = { ...asset, bytes, source: claim,
      originalName: claim.originalName ?? `${asset.assetId}.${extension(asset.format)}`,
      originalPath: pathFor(prefix, input.ownerId, asset.sha256, asset.format, "original"),
      servedPath: pathFor(prefix, input.ownerId, asset.sha256, asset.format, "served") };
    await persist(artifact, deps);
    written.set(asset.sha256, artifact);
  }
  return [...written.values()];
}
