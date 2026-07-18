import { createHash } from "crypto";
import { getStorage } from "firebase-admin/storage";
import type { Bucket } from "@google-cloud/storage";
import type { PlanAsset } from "../planning/buildPlan";
import type { AssetClaimInput } from "../store/assetClaimStore";
import { cdnUrl, originalPath, publicBucketName, servedPath } from "../../config/catalogConfig";
import { toWoff2, type FontFormat } from "../../storage/transcode";

export interface PlannedAssetClaim extends AssetClaimInput { bytes?: Buffer; sourcePath?: string; originalName?: string; }
export interface WrittenPlannedAsset extends PlanAsset {
  originalPath: string; servedPath: string; originalUrl: string; servedUrl: string; originalName: string; servedName: string;
  bytes: Buffer; servedBytes: Buffer; source: PlannedAssetClaim;
}
export interface WritePlannedAssetsDependencies {
  publicBucket?: Pick<Bucket, "file">;
  read?: (claim: PlannedAssetClaim) => Promise<Buffer>;
  write?: (artifact: WrittenPlannedAsset) => Promise<void>;
}

const safe = (value: string, field: string): string => {
  if (!value || value.includes("/")) throw new Error(`invalid ${field}`);
  return value;
};
const extension = (format: string): string => format.replace(/^\./, "").toLowerCase();
async function persist(artifact: WrittenPlannedAsset, deps: WritePlannedAssetsDependencies): Promise<void> {
  if (deps.write) return deps.write(artifact);
  const bucket = deps.publicBucket ?? getStorage().bucket(publicBucketName());
  await bucket.file(artifact.originalPath).save(artifact.bytes, { resumable: false, contentType: `font/${extension(artifact.format)}`, metadata: { cacheControl: "public, max-age=31536000, immutable" } });
  await bucket.file(artifact.servedPath).save(artifact.servedBytes, { resumable: false, contentType: artifact.servedName.endsWith(".woff2") ? "font/woff2" : `font/${extension(artifact.format)}`, metadata: { cacheControl: "public, max-age=31536000, immutable" } });
}

export async function writePlannedAssets(input: {
  ownerId: string; familyId: string; familySlug: string; assets: readonly PlanAsset[]; claims: readonly PlannedAssetClaim[];
}, deps: WritePlannedAssetsDependencies = {}): Promise<WrittenPlannedAsset[]> {
  safe(input.ownerId, "ownerId");
  const claims = new Map(input.claims.map((claim) => [claim.assetId, claim]));
  const written = new Map<string, WrittenPlannedAsset>();
  for (const asset of input.assets) {
    const claim = claims.get(asset.assetId);
    if (!claim || claim.sha256 !== asset.sha256) throw new Error(`missing leased claim for ${asset.assetId}`);
    const prior = written.get(asset.sha256);
    if (prior) continue;
    const bytes = claim.bytes ?? (deps.read ? await deps.read(claim) : undefined);
    if (!bytes) throw new Error(`missing source bytes for ${asset.assetId}`);
    if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error(`sha256 mismatch for ${asset.assetId}`);
    const originalName = claim.originalName ?? `${safe(asset.assetId, "assetId")}.${extension(asset.format)}`;
    const woff2 = await toWoff2(bytes, asset.format as FontFormat);
    const servedName = woff2 ? `${safe(asset.assetId, "assetId")}.woff2` : originalName;
    const artifact: WrittenPlannedAsset = { ...asset, bytes, servedBytes: woff2 ? Buffer.from(woff2) : bytes, source: claim, originalName, servedName,
      originalPath: originalPath(safe(input.familySlug, "familySlug"), asset.sha256, originalName),
      servedPath: servedPath(safe(input.familySlug, "familySlug"), asset.sha256, servedName),
      originalUrl: cdnUrl(originalPath(safe(input.familySlug, "familySlug"), asset.sha256, originalName)),
      servedUrl: cdnUrl(servedPath(safe(input.familySlug, "familySlug"), asset.sha256, servedName)) };
    await persist(artifact, deps);
    written.set(asset.sha256, artifact);
  }
  return [...written.values()];
}
