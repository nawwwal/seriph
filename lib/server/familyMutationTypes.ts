export const FAMILIES_COLLECTION = 'fontfamilies';
export const MERGE_COLLECTION = 'familyMergeOperations';
export const MERGE_VERSION = 'shelf-grouping-v1';
export const UNDO_WINDOW_MS = 5 * 60 * 1000;
export const PUBLIC_BUCKET = process.env.CATALOG_PUBLIC_BUCKET || process.env.FIREBASE_PUBLIC_BUCKET || 'seriph-fonts';

export const STALE_ENRICHMENT_FIELDS = [
  'enrichment',
  'searchText',
  'searchTokens',
  'searchMeta',
  'text_vec',
  'mood_vec',
  'use_case_vec',
  'image_vec',
] as const;

export type MutationErrorCode = 'bad_request' | 'forbidden' | 'not_found';
export type MutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: MutationErrorCode; message: string };

export interface CatalogFace {
  id: string;
  contentHash?: string;
  weight?: number;
  italic?: boolean;
  isVariable?: boolean;
  woff2?: { storagePath?: string };
  original?: { storagePath?: string };
  [key: string]: unknown;
}

export interface CatalogFamily {
  id?: string;
  slug?: string;
  name?: string;
  ownerId?: string;
  status?: string;
  hidden?: boolean;
  mergedInto?: string;
  aliasOf?: string;
  faces?: CatalogFace[];
  styleCount?: number;
  isVariable?: boolean;
  axes?: unknown[];
  coverFaceId?: string;
  coverFace?: Record<string, unknown>;
  manualMerge?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FamilyInput {
  familyId: string;
  data: CatalogFamily | null;
}

export type FamilyLike = FamilyInput | CatalogFamily;

export interface MergeSnapshot {
  familyId: string;
  data: CatalogFamily;
}

export interface FamilyMergePlan {
  mergeId: string;
  targetFamilyId: string;
  targetDoc: CatalogFamily;
  aliasDocs: Array<{ familyId: string; doc: CatalogFamily }>;
  operation: {
    id: string;
    ownerId: string;
    targetFamilyId: string;
    sourceFamilyIds: string[];
    selectedFamilyIds: string[];
    snapshots: MergeSnapshot[];
    undoExpiresAt: string;
    createdAt: string;
  };
  undoExpiresAt: string;
  deletedFieldNames: readonly string[];
}

export interface HardDeletePlan {
  docIds: string[];
  storagePaths: string[];
}
