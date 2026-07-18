import { ImportError } from "./batch";

export type ImportItemState =
  | "discovered" | "classified" | "planned" | "applied" | "duplicate"
  | "review" | "discarded" | "failed";

export type ImportItemRole =
  | "font" | "source" | "documentation" | "web" | "archive" | "junk"
  | "unresolved";

export type ImportItemAction =
  | "apply" | "keep_private" | "discard" | "review" | "deduplicate";

export type ImportItemReason =
  | "detected_font" | "source_asset" | "documentation" | "web_asset"
  | "archive_container" | "unsupported_content" | "ambiguous_identity"
  | "unsafe_archive" | "duplicate_content" | "disposable_name";

export interface ImportArchiveLineageEntry {
  archiveItemId: string;
  entryPath: string;
}

export interface ImportItemDestination {
  familyId?: string;
  faceId?: string;
  assetId?: string;
}

export interface ImportItem {
  itemId: string;
  ownerId: string;
  batchId: string;
  sourceId: string;
  originalPath: string;
  archiveLineage: ImportArchiveLineageEntry[];
  filename: string;
  extension: string;
  byteSize: number;
  crc32?: number;
  contentHash: string;
  detectedFormat: string;
  mimeType: string;
  role: ImportItemRole;
  action: ImportItemAction;
  reason: ImportItemReason;
  destination?: ImportItemDestination;
  state: ImportItemState;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  error?: ImportError;
}
