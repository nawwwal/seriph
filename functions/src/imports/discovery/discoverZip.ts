import * as unzipper from "unzipper";
import { buildInventoryItem, type InventoryItem, type InventoryProvenance } from "./inventory";
import { assessArchiveEntry, type ArchiveDecision, type ArchiveLimits, review } from "./archivePolicy";
import { archiveStagingPath } from "./archivePaths";
import type { ImportTaskPayload } from "../tasks/enqueue";

export interface ArchiveChild {
  inventory: InventoryItem;
  staging: { path: string; bytes: Buffer; contentHash: string };
  task: ImportTaskPayload;
}
export interface ArchiveDiscovery { children: ArchiveChild[]; reviews: ArchiveDecision[] }
export interface DiscoverZipInput extends Omit<InventoryProvenance, "bytes"> {
  archiveItemId: string; bytes: Buffer; limits: ArchiveLimits; depth?: number;
}

type ZipFile = unzipper.File;
const metadata = (file: ZipFile) => ({
  entryPath: file.path, type: file.type, flags: file.flags, compressionMethod: file.compressionMethod,
  compressedSize: file.compressedSize, uncompressedSize: file.uncompressedSize,
  versionMadeBy: file.versionMadeBy, externalFileAttributes: file.externalFileAttributes,
});

export async function inspectArchive(bytes: Buffer, limits: ArchiveLimits, depth = 0): Promise<ArchiveDecision[]> {
  if (depth > limits.maxDepth) return [review("", "max_depth")];
  let directory: unzipper.CentralDirectory;
  try { directory = await unzipper.Open.buffer(bytes); } catch { return [review("", "malformed_archive")]; }
  if (directory.files.length > limits.maxEntries) return [review("", "entry_limit")];
  const decisions: ArchiveDecision[] = [];
  let expandedBytes = 0;
  const seenPaths = new Set<string>();
  for (const file of directory.files) {
    const decision = assessArchiveEntry(metadata(file), limits, expandedBytes);
    if (file.type === "Directory" && decision.action === "stage") continue;
    if (decision.action === "stage" && decision.normalizedPath && seenPaths.has(decision.normalizedPath)) {
      decisions.push(review(file.path, "path_collision"));
      continue;
    }
    decisions.push(decision);
    if (decision.action === "stage") {
      seenPaths.add(decision.normalizedPath!);
      expandedBytes += file.uncompressedSize;
    }
  }
  return decisions.sort((a, b) => a.entryPath.localeCompare(b.entryPath));
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
};

export async function discoverZip(input: DiscoverZipInput): Promise<ArchiveDiscovery> {
  const decisions = await inspectArchive(input.bytes, input.limits, input.depth ?? input.archiveLineage.length);
  const allowed = new Map(decisions.filter((item) => item.action === "stage").map((item) => [item.entryPath, item]));
  const reviews = decisions.filter((item) => item.action === "review");
  if (!allowed.size) return { children: [], reviews };
  const directory = await unzipper.Open.buffer(input.bytes);
  const seenPaths = new Set<string>();
  const files = directory.files.filter((file) => allowed.has(file.path) && !seenPaths.has(file.path) && seenPaths.add(file.path))
    .sort((a, b) => a.path.localeCompare(b.path));
  const children: ArchiveChild[] = [];
  let expandedBytes = 0;
  for (const file of files) {
    const bytes = await file.buffer();
    expandedBytes += bytes.byteLength;
    if (bytes.byteLength > input.limits.maxEntryBytes || expandedBytes > input.limits.maxExpandedBatchBytes) {
      reviews.push(review(file.path, bytes.byteLength > input.limits.maxEntryBytes ? "entry_size" : "expanded_size"));
      continue;
    }
    const safePath = allowed.get(file.path)!.normalizedPath!;
    const lineage = [...input.archiveLineage, { archiveItemId: input.archiveItemId, entryPath: file.path }];
    const inventory = await buildInventoryItem({ ...input, bytes, archiveLineage: lineage,
      originalPath: input.originalPath, filename: safePath.split("/").pop()!, extension: extensionOf(safePath),
      declaredMimeType: "application/octet-stream", name: safePath });
    children.push({ inventory, staging: { path: archiveStagingPath({ ...input, entryPath: safePath }), bytes, contentHash: inventory.sha256 },
      task: { kind: "discover_item", ownerId: input.ownerId, batchId: input.batchId, resourceId: inventory.itemId, planVersion: 1 } });
  }
  return { children, reviews };
}
