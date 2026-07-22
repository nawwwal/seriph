import * as unzipper from "unzipper";
import { buildInventoryItem, type InventoryInput, type InventoryItem, type InventoryProvenance } from "./inventory";
import { assessArchiveEntry, type ArchiveDecision, type ArchiveLimits, review } from "./archivePolicy";
import { archiveStagingPath } from "./archivePaths";
import type { ImportTaskPayload } from "../tasks/enqueue";
export { persistArchiveDiscovery } from "./archivePersistence";

export interface ArchiveChild {
  inventory: InventoryItem;
  staging: { path: string; bytes: Buffer; contentHash: string };
  task: ImportTaskPayload;
}
export interface ArchiveDiscovery { children: ArchiveChild[]; reviews: ArchiveDecision[]; canceled?: boolean }
export interface DiscoverZipInput extends Omit<InventoryProvenance, "bytes"> {
  archiveItemId: string; bytes: Buffer; limits: ArchiveLimits; depth?: number;
  reserve?: (reservationId: string, bytes: number) => Promise<ArchiveReservation>;
  isCanceled?: () => Promise<boolean>;
}
export interface ArchiveReservation { kind: "reserved" | "exists" | "exceeded"; remainingBytes: number; reservationBytes: number }

type ZipFile = unzipper.File;
export interface StreamEntry { path: string; stream: () => AsyncIterable<Uint8Array> }
const metadata = (file: ZipFile) => ({
  entryPath: file.path, type: file.type, flags: file.flags, compressionMethod: file.compressionMethod,
  compressedSize: file.compressedSize, uncompressedSize: file.uncompressedSize,
  versionMadeBy: file.versionMadeBy, externalFileAttributes: file.externalFileAttributes,
});

export async function extractEntryBounded(entry: StreamEntry, maxEntryBytes: number, maxExpandedBatchBytes: number, expandedBytes = 0): Promise<Buffer | ArchiveDecision> {
  const chunks: Buffer[] = []; let total = 0; const stream = entry.stream();
  try {
    for await (const chunk of stream) {
      total += chunk.byteLength;
      if (total > maxEntryBytes) { if ("destroy" in stream) (stream as AsyncIterable<Uint8Array> & { destroy?: () => void }).destroy?.(); return review(entry.path, "entry_size"); }
      if (expandedBytes + total > maxExpandedBatchBytes) { if ("destroy" in stream) (stream as AsyncIterable<Uint8Array> & { destroy?: () => void }).destroy?.(); return review(entry.path, "expanded_size"); }
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks, total);
  } catch { return review(entry.path, "decompression_failure"); }
}

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
  const context = (decision: ArchiveDecision): ArchiveDecision => ({ ...decision, parentItemId: input.archiveItemId,
    lineage: [...input.archiveLineage, { archiveItemId: input.archiveItemId, entryPath: decision.entryPath }] });
  const reviews = decisions.filter((item) => item.action === "review").map(context);
  if (!allowed.size) return { children: [], reviews };
  let directory: unzipper.CentralDirectory;
  try { directory = await unzipper.Open.buffer(input.bytes); } catch { return { children: [], reviews: [...reviews, context(review("", "malformed_archive"))] }; }
  const seenPaths = new Set<string>();
  const files = directory.files.filter((file) => allowed.has(file.path) && !seenPaths.has(file.path) && seenPaths.add(file.path))
    .sort((a, b) => a.path.localeCompare(b.path));
  const children: ArchiveChild[] = [];
  let expandedBytes = 0;
  for (const file of files) {
    if (await input.isCanceled?.()) return { children, reviews, canceled: true };
    const reservation = input.reserve ? await input.reserve(`${input.archiveItemId}:${file.path}`, file.uncompressedSize) : undefined;
    if (reservation?.kind === "exceeded") { reviews.push(context(review(file.path, "expanded_size"))); continue; }
    const extractionBudget = reservation ? reservation.remainingBytes + reservation.reservationBytes : input.limits.maxExpandedBatchBytes;
    const extracted = await extractEntryBounded(file, input.limits.maxEntryBytes, extractionBudget, reservation ? 0 : expandedBytes);
    if (!Buffer.isBuffer(extracted)) { reviews.push(context(extracted)); continue; }
    const bytes = extracted;
    expandedBytes += bytes.byteLength;
    const safePath = allowed.get(file.path)!.normalizedPath!;
    const lineage = [...input.archiveLineage, { archiveItemId: input.archiveItemId, entryPath: file.path }];
    const childInput: InventoryInput = { ownerId: input.ownerId, batchId: input.batchId, sourceId: input.sourceId,
      originalPath: input.originalPath, archiveLineage: lineage,
      filename: safePath.split("/").pop()!, extension: extensionOf(safePath),
      declaredMimeType: "application/octet-stream", bytes, name: safePath };
    const inventory = await buildInventoryItem(childInput);
    const stagingPath = archiveStagingPath({ ...input, entryPath: safePath });
    children.push({ inventory: { ...inventory, stagingPath }, staging: { path: stagingPath, bytes, contentHash: inventory.sha256 },
      task: { kind: "discover_item", ownerId: input.ownerId, batchId: input.batchId, resourceId: inventory.itemId, planVersion: 1, archiveBudgetKey: input.batchId } });
  }
  return { children, reviews };
}
