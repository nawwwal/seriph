import type { GfCategory } from "../storage/canonicalize";
import type { CanonicalAxis, FontFace } from "./catalog.assets";
import type { FamilyStatus, FontEnrichment, SearchMeta } from "./catalog.enrichment";

export interface FontFamilyDoc {
  id: string;
  slug: string;
  name: string;
  fileBase: string;
  category: GfCategory;
  classification?: string;
  foundry?: string;
  designer?: string;
  license?: string;
  subsets?: string[];
  axes?: CanonicalAxis[];
  faces: FontFace[];
  styleCount?: number;
  coverFaceId?: string;
  enrichment?: FontEnrichment;
  ownerId?: string;
  status: FamilyStatus;
  hidden?: boolean;
  mergedInto?: string;
  aliasOf?: string;
  mergedIntoId?: string;
  aliasOfId?: string;
  canonicalMerge?: {
    version?: string;
    targetSlug?: string;
    sourceSlugs?: string[];
    aliases?: string[];
    mergedAt?: FirebaseFirestore.Timestamp | Date | string;
  };
  manualMerge?: {
    version?: string;
    mergeId?: string;
    targetFamilyId?: string;
    sourceFamilyIds?: string[];
    selectedFamilyIds?: string[];
    displayNamePending?: boolean;
    requestedAt?: FirebaseFirestore.Timestamp | Date | string;
  };
  version: number;
  searchText?: string;
  searchTokens?: string[];
  searchMeta?: SearchMeta;
  searchIndexState?: "ready" | "retry";
  searchIndexError?: string;
  enrichmentJobId?: string;
  enrichmentJobVersion?: number;
  enrichmentLeaseExpiresAt?: FirebaseFirestore.Timestamp | Date | string;
  text_vec?: unknown;
  mood_vec?: unknown;
  use_case_vec?: unknown;
  image_vec?: unknown;
  createdAt?: FirebaseFirestore.Timestamp | Date | string;
  updatedAt?: FirebaseFirestore.Timestamp | Date | string;
}

export interface FamilyManifest {
  name: string;
  slug: string;
  category: GfCategory;
  designer?: string;
  license?: string;
  subsets?: string[];
  axes?: CanonicalAxis[];
  fonts: Array<{
    style: "normal" | "italic";
    weight: number;
    filename: string;
    postScriptName?: string;
    url: string;
  }>;
}
