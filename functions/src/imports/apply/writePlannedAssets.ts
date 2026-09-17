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
  isCanceled?: () => Promise<boolean>;
}

const safe = (value: string, field: string): string => {
  if (!value || value.includes("/")) throw new Error(`invalid ${field}`);
  return value;
};
const extension = (format: string): string => format.replace(/^\./, "").toLowerCase();
const WRITE_CONCURRENCY = 4;
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
  const claims = new Map(input.claims.map((claim) => [claim.sha256, claim]));
  const uniqueAssets = input.assets.filter((asset, index, all) => all.findIndex((candidate) => candidate.sha256 === asset.sha256) === index);
  const written = new Array<WrittenPlannedAsset>(uniqueAssets.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = next++;
      if (index >= uniqueAssets.length) return;
      const asset = uniqueAssets[index]!;
      if (await deps.isCanceled?.()) throw new Error("batch_canceled");
      const claim = claims.get(asset.sha256);
      if (!claim || claim.sha256 !== asset.sha256) throw new Error(`missing leased claim for ${asset.assetId}`);
      const canonicalAssetId = claim.assetId || asset.assetId;
      const bytes = claim.bytes ?? (deps.read ? await deps.read(claim) : undefined);
      if (!bytes) throw new Error(`missing source bytes for ${asset.assetId}`);
      if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error(`sha256 mismatch for ${asset.assetId}`);
      const originalName = claim.originalName ?? `${safe(canonicalAssetId, "assetId")}.${extension(asset.format)}`;
      const woff2 = await toWoff2(bytes, asset.format as FontFormat);
      const servedName = woff2 ? `${safe(canonicalAssetId, "assetId")}.woff2` : originalName;
      const artifact: WrittenPlannedAsset = { ...asset, assetId: canonicalAssetId, bytes, servedBytes: woff2 ? Buffer.from(woff2) : bytes, source: claim, originalName, servedName,
        originalPath: originalPath(safe(input.familySlug, "familySlug"), asset.sha256, originalName),
        servedPath: servedPath(safe(input.familySlug, "familySlug"), asset.sha256, servedName),
        originalUrl: cdnUrl(originalPath(safe(input.familySlug, "familySlug"), asset.sha256, originalName)),
        servedUrl: cdnUrl(servedPath(safe(input.familySlug, "familySlug"), asset.sha256, servedName)) };
      await persist(artifact, deps);
      if (await deps.isCanceled?.()) throw new Error("batch_canceled");
      written[index] = artifact;
    }
  };
  await Promise.all(Array.from({ length: Math.min(WRITE_CONCURRENCY, uniqueAssets.length) }, () => worker()));
  return written;
}
