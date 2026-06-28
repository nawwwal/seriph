/**
 * Clean catalog schema for the rebuilt pipeline (Google Fonts–style).
 * Pure type declarations — exempt from the <100-line guideline.
 *
 * Replaces the deeply-nested legacy `font.models` shape. A family document holds
 * canonical faces (each with CDN urls), optional enrichment, and — once enriched —
 * Firestore vector fields for semantic search.
 *
 * Firestore layout:
 *   fontfamilies/{slug}                      (public catalog)
 *   users/{uid}/fontfamilies/{slug}          (owner-scoped)
 */

import type { GfCategory } from '../storage/canonicalize';

export type FamilyStatus = 'ready' | 'enriching' | 'enriched' | 'failed';

/** A variable-font axis as stored on the family. */
export interface CanonicalAxis {
  tag: string; // e.g. "wght", "opsz", custom "GRAD"
  min: number;
  max: number;
  default: number;
  name?: string;
}

/** Where a served artifact lives (private storage path + public CDN url). */
export interface ServedAsset {
  storagePath: string; // path inside the public served bucket, e.g. "s/inter/3/Inter[opsz,wght].woff2"
  url: string; // stable CDN url via Firebase Hosting, e.g. "https://fonts.seriph.app/s/inter/3/Inter[opsz,wght].woff2"
}

/** One canonical face (a static style, or a variable file covering a range). */
export interface FontFace {
  id: string; // stable within family, e.g. "bold-italic" or "vf" / "vf-italic"
  styleName: string; // GF style suffix, e.g. "SemiBold", "BoldItalic", "Regular", or "Variable"
  weight: number; // canonical GF weight (default instance weight for variable)
  weightName: string; // "SemiBold" etc.
  italic: boolean;
  isVariable: boolean;
  axes?: CanonicalAxis[]; // present when isVariable
  format: string; // original format: TTF | OTF | WOFF | WOFF2 | EOT
  postScriptName?: string;
  fullName?: string;
  fileSize: number; // original file size in bytes
  filename: string; // canonical filename (woff2), e.g. "Inter-SemiBold.woff2"
  woff2: ServedAsset; // optimized web artifact
  original: ServedAsset; // original upload, for download
  contentHash?: string;
  /** Deterministic parser metadata the UI consumes (character set, features, …). */
  meta?: {
    characterSetCoverage?: string[];
    openTypeFeatures?: string[];
    glyphCount?: number;
    languageSupport?: string[];
    version?: string;
    copyright?: string;
    license?: string;
  };
}

/** AI enrichment produced by the single multimodal pass. */
export interface FontEnrichment {
  category: GfCategory; // primary GF category
  classification?: string; // finer label, e.g. "humanist sans"
  summary?: string; // 1–2 sentence description
  moods?: string[];
  voice?: string;
  useCases?: string[];
  pairingHints?: string[];
  confidence?: number;
  modelId?: string; // analysis model used
  promptVersion?: string;
  embeddingModel?: string;
  embeddingVersion?: string;
  enrichedAt?: FirebaseFirestore.Timestamp | Date | string;
}

/** The family document. Vector fields are written via FieldValue.vector(). */
export interface FontFamilyDoc {
  id: string; // family slug
  slug: string;
  name: string;
  fileBase: string; // filename token, e.g. "IBMPlexSans"
  category: GfCategory;
  classification?: string;
  foundry?: string;
  designer?: string;
  license?: string;
  subsets?: string[];
  axes?: CanonicalAxis[]; // union of variable axes across faces
  faces: FontFace[];
  coverFaceId?: string; // face used for the specimen/cover (defaults to Regular)
  enrichment?: FontEnrichment;
  ownerId?: string;
  status: FamilyStatus;
  version: number; // bumped on each (re)write of served assets — used in CDN paths
  // Vector fields (Firestore VectorValue) — present only after enrichment.
  // Typed loosely because admin SDK writes them via FieldValue.vector(number[]).
  text_vec?: unknown;
  image_vec?: unknown;
  createdAt?: FirebaseFirestore.Timestamp | Date | string;
  updatedAt?: FirebaseFirestore.Timestamp | Date | string;
}

/**
 * Served per-family manifest (our METADATA.pb equivalent), written as
 * `s/<slug>/<version>/family.json`. Mirrors Google Fonts METADATA fields.
 */
export interface FamilyManifest {
  name: string;
  slug: string;
  category: GfCategory;
  designer?: string;
  license?: string;
  subsets?: string[];
  axes?: CanonicalAxis[];
  fonts: Array<{
    style: 'normal' | 'italic';
    weight: number;
    filename: string;
    postScriptName?: string;
    url: string;
  }>;
}
