export interface ArchiveLimits {
  maxDepth: number;
  maxEntries: number;
  maxExpandedBatchBytes: number;
  maxEntryBytes: number;
  maxCompressionRatio: number;
  maxPathBytes: number;
}

export interface ArchiveEntryMetadata {
  entryPath: string;
  type?: string;
  flags: number;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  versionMadeBy?: number;
  externalFileAttributes?: number;
}

export interface ArchiveDecision {
  action: "stage" | "review";
  reasonCode: string;
  entryPath: string;
  normalizedPath?: string;
  parentItemId?: string;
  lineage?: Array<{ archiveItemId: string; entryPath: string }>;
}

export function normalizeArchivePath(entryPath: string, maxPathBytes = 1024): string | ArchiveDecision {
  const normalized = entryPath.normalize("NFKC").replace(/\\/g, "/");
  if (normalized.includes("\0")) return review(entryPath, "invalid_path");
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return review(entryPath, "absolute_path");
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") return review(entryPath, "path_traversal");
    parts.push(part);
  }
  const safePath = parts.join("/");
  if (!safePath) return review(entryPath, "empty_path");
  if (Buffer.byteLength(safePath, "utf8") > maxPathBytes) return review(entryPath, "path_length");
  return safePath;
}

export function review(entryPath: string, reasonCode: string): ArchiveDecision {
  return { action: "review", reasonCode, entryPath };
}

const isSymlink = (entry: ArchiveEntryMetadata): boolean => {
  const unix = (entry.externalFileAttributes ?? 0) >>> 16;
  return (entry.versionMadeBy ?? 0) >>> 8 === 3 && (unix & 0xf000) === 0xa000;
};

export function assessArchiveEntry(entry: ArchiveEntryMetadata, limits: ArchiveLimits, expandedBytes = 0): ArchiveDecision {
  const safePath = normalizeArchivePath(entry.entryPath, limits.maxPathBytes);
  if (typeof safePath !== "string") return safePath;
  if (entry.flags & 1) return review(entry.entryPath, "encrypted_entry");
  if (isSymlink(entry)) return review(entry.entryPath, "symlink_entry");
  if (![0, 8].includes(entry.compressionMethod)) return review(entry.entryPath, "unsupported_entry");
  if (entry.uncompressedSize > limits.maxEntryBytes) return review(entry.entryPath, "entry_size");
  if (entry.compressedSize <= 0 ? entry.uncompressedSize > 0 : entry.uncompressedSize / entry.compressedSize > limits.maxCompressionRatio) {
    return review(entry.entryPath, "compression_ratio");
  }
  if (expandedBytes + entry.uncompressedSize > limits.maxExpandedBatchBytes) return review(entry.entryPath, "expanded_size");
  return { action: "stage", reasonCode: "safe_entry", entryPath: entry.entryPath, normalizedPath: safePath };
}
