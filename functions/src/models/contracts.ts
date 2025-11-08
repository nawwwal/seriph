// Taxonomy and contract definitions for Font Intelligence System v1 (taxonomy_version: 1.0.0)
// This module centralizes enum canons, TypeScript types, and JSON Schemas consumed by the AI pipeline.

export const TAXONOMY_VERSION = "1.0.0";

// ---- Enumerations (frozen) ----
// Primary and core enums (previously shipped)
export const STYLE_PRIMARY = [
	"serif",
	"sans",
	"slab",
	"mono",
	"display",
	"script",
	"blackletter",
	"icon",
] as const;
export type StylePrimary = (typeof STYLE_PRIMARY)[number];

export const SUBSTYLE = [
	"oldstyle",
	"transitional",
	"didone",
	"humanist",
	"grotesque",
	"neo_grotesque",
	"geometric",
	"humanist_serif",
	"mechanistic",
	"clarendon",
	"rounded",
	"reverse_contrast",
	"handwriting",
	"brush",
	"calligraphic",
	"stencil",
	"bitmap",
	"decorative",
	"industrial",
	"techno",
	"unknown",
] as const;
export type Substyle = (typeof SUBSTYLE)[number];

export const MOODS = [
	"neutral",
	"friendly",
	"authoritative",
	"elegant",
	"playful",
	"technical",
	"classic",
	"brutal",
	"warm",
	"refined",
	"energetic",
	"minimalist",
	"retro",
	"futuristic",
	"serious",
	"expressive",
] as const;
export type Mood = (typeof MOODS)[number];

export const USE_CASES = [
	"body_text",
	"ui",
	"editorial",
	"poster",
	"branding",
	"wayfinding",
	"code",
	"packaging",
	"headlines",
	"signage",
	"motion",
	"print",
	"digital",
	"decorative",
	"variable_expressive",
] as const;
export type UseCase = (typeof USE_CASES)[number];

export const WARNINGS = [
	"insufficient_script_support",
	"shaping_issues",
	"license_unknown",
	"conflicting_metadata",
	"low_contrast_for_body",
	"poor_legibility_small_sizes",
	"web_claims_disagree",
	"partial_enrichment",
	"duplicate_font",
	"variable_axes_missing",
	"corrupted_tables",
	"color_font_detected",
	"non_latin_primary_script",
] as const;
export type WarningTag = (typeof WARNINGS)[number];

export const SERIF_TYPE = [
	"bracketed",
	"unbracketed",
	"slab",
	"flared",
	"ball",
	"none",
] as const;
export type SerifType = (typeof SERIF_TYPE)[number];

export const VARIABLE_AXIS_TAGS = [
	"wght",
	"wdth",
	"opsz",
	"ital",
	"slnt",
	"GRAD",
	"XOPQ",
	"YOPQ",
	"SOFT",
	"WONK",
	"SPAC",
	"MONO",
	"CUSTOM_*",
] as const;
export type VariableAxisTag = (typeof VARIABLE_AXIS_TAGS)[number];

export const FONT_TYPE = [
	"static_font",
	"variable_font",
	"color_font",
	"icon_font",
	"multi_script_font",
	"damaged_font",
	"duplicate_reference",
] as const;
export type FontType = (typeof FONT_TYPE)[number];

export const LICENSE_TYPE = [
	"OFL",
	"Apache_2_0",
	"MIT",
	"GPL",
	"CC_BY",
	"Proprietary_Commercial",
	"Custom_Non_Commercial",
	"Public_Domain",
	"Unknown",
] as const;
export type LicenseType = (typeof LICENSE_TYPE)[number];

export const SCRIPT_TAGS = [
	"Latn",
	"Cyrl",
	"Grek",
	"Deva",
	"Arab",
	"Hebr",
	"Thai",
	"Hang",
	"Hani",
	"Kana",
	"Beng",
	"Taml",
	"Knda",
	"Mlym",
	"Guru",
	"Sinh",
	"Telu",
	"Cans",
	"Cher",
	"Orya",
	"Mymr",
	"Ethi",
	"Armn",
	"Geor",
	"Laoo",
	"Tibt",
	"Ogham",
	"Runr",
	"Unknown",
] as const;
export type ScriptTag = (typeof SCRIPT_TAGS)[number];

export const ANALYSIS_STATE = [
	"not_started",
	"queued",
	"extracting",
	"ai_classifying",
	"enriching",
	"indexing",
	"complete",
	"error",
	"retrying",
	"quarantined",
] as const;
export type AnalysisState = (typeof ANALYSIS_STATE)[number];

// ---- Evidence Keying ----
// Use flat, human-readable keys to cite objective evidence (no opaque IDs).
// Examples: "metrics.contrast_index", "metrics.x_height_ratio", "shaping.Devanagari.pass", "features.liga"
export type EvidenceKey = string;

// ---- New v1 Enumerations (optional fields default to "unknown") ----
export const SERIF_PRESENCE = ["none", "partial", "full", "unknown"] as const;
export type SerifPresence = (typeof SERIF_PRESENCE)[number];

export const AXIS_ROLE = [
	"weight",
	"width",
	"optical_size",
	"italic",
	"slant",
	"grade",
	"custom",
	"unknown",
] as const;
export type AxisRole = (typeof AXIS_ROLE)[number];

export const COLOR_FONT_FORMAT = [
	"COLRv0",
	"COLRv1",
	"CBDT",
	"SBIX",
	"SVG",
	"unknown",
] as const;
export type ColorFontFormat = (typeof COLOR_FONT_FORMAT)[number];

export const RENDERING_ENGINE_PROFILE = [
	"ttf_hinting",
	"cff1",
	"cff2",
	"var_gx",
	"var_cff2",
	"bitmap",
	"svg",
	"sbix",
	"colrv0",
	"colrv1",
	"unknown",
] as const;
export type RenderingEngineProfile = (typeof RENDERING_ENGINE_PROFILE)[number];

export const CONFIDENCE_BAND = ["low", "medium", "high", "very_high", "unknown"] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BAND)[number];

export interface ConfidenceInfo {
	value?: number; // 0..1
	band: ConfidenceBand; // derived via RC thresholds
}

export const VOX_ATYPI_CLASS = [
	"humanist",
	"garalde",
	"transitional",
	"didone",
	"mechanistic",
	"lineal_humanist",
	"lineal_grotesque",
	"lineal_neo_grotesque",
	"lineal_geometric",
	"glyphic",
	"scripts",
	"blackletter",
	"decorative",
	"unknown",
] as const;
export type VoxATypiClass = (typeof VOX_ATYPI_CLASS)[number];

// In v1, historical_model aliases vox_atypi_class to avoid taxonomy drift
export const HISTORICAL_MODEL = [...VOX_ATYPI_CLASS] as const;
export type HistoricalModel = (typeof HISTORICAL_MODEL)[number];

export const HISTORICAL_ERA = [
	"renaissance",
	"baroque",
	"enlightenment",
	"victorian",
	"modernist",
	"digital",
	"postmodern",
	"contemporary",
	"unknown",
] as const;
export type HistoricalEra = (typeof HISTORICAL_ERA)[number];

export const PROVENANCE_SOURCE_TYPE = [
	"foundry_site",
	"retailer",
	"repo",
	"docs",
	"gf",
	"other",
	"unknown",
] as const;
export type ProvenanceSourceType = (typeof PROVENANCE_SOURCE_TYPE)[number];

export const FOUNDRY_TYPE = [
	"independent",
	"corp",
	"collective",
	"open_source",
	"unknown",
] as const;
export type FoundryType = (typeof FOUNDRY_TYPE)[number];

export const DISTRIBUTION_CHANNEL = [
	"foundry",
	"marketplace",
	"github",
	"package_manager",
	"system",
	"other",
	"unknown",
] as const;
export type DistributionChannel = (typeof DISTRIBUTION_CHANNEL)[number];

export const EMBEDDING_TYPE = ["text", "vision", "multimodal_fusion", "unknown"] as const;
export type EmbeddingType = (typeof EMBEDDING_TYPE)[number];

export const PAIRING_TYPE = ["contrast", "complement", "harmonic", "genre_mix", "unknown"] as const;
export type PairingType = (typeof PAIRING_TYPE)[number];

export const NORMALIZATION_CHANGE_REASON = [
	"naming_canonicalization",
	"weight_normalization",
	"axis_alias",
	"metadata_fix",
	"duplicate_merge",
	"license_correction",
] as const;
export type NormalizationChangeReason = (typeof NORMALIZATION_CHANGE_REASON)[number];

export const UPLOAD_STATE = [
	"queued",
	"parsing",
	"parsed",
	"ai_classifying",
	"ai_retrying",
	"web_enriching",
	"enriched",
	"indexed",
	"quarantined",
	"failed",
	"completed",
] as const;
export type UploadState = (typeof UPLOAD_STATE)[number];

export const JOB_OUTCOME = ["success", "partial", "failed", "skipped_duplicate"] as const;
export type JobOutcome = (typeof JOB_OUTCOME)[number];

export const DUPLICATE_RESOLUTION = [
	"hash_dedupe",
	"name_version_conflict",
	"foundry_alias",
	"manual_override",
] as const;
export type DuplicateResolution = (typeof DUPLICATE_RESOLUTION)[number];

export const SIMILARITY_METHOD = [
	"vision_embedding_cosine",
	"semantic_embedding_cosine",
	"hybrid_ranker",
	"manual_curation",
] as const;
export type SimilarityMethod = (typeof SIMILARITY_METHOD)[number];

// License policy flags are free-form labels in v1
export type LicenseFlag =
	| "web_embedded"
	| "desktop"
	| "app_embed"
	| "open_source"
	| "requires_attribution"
	| "redistribution_restricted"
	| "seat_based"
	| "pageview_based"
	| "trial_only";

// Feature tags are OpenType feature tags (registered) or custom prefixed 'cust_'
export type FeatureTag = string; // e.g., 'liga', 'kern', 'ss01', 'cust_alt'

// ---- AI Output Contracts ----
export interface ClassificationItem {
	value: string;
	confidence: number; // 0..1
	evidence_keys?: EvidenceKey[];
}

export interface VisualClassification {
	style_primary: ClassificationItem & { value: StylePrimary };
	substyle?: ClassificationItem & { value: Substyle };
	moods?: ClassificationItem[]; // each value must be in MOODS
	use_cases?: ClassificationItem[]; // each value must be in USE_CASES
	negative_tags?: string[];
	warnings?: WarningTag[];
	serif_type?: ClassificationItem & { value: SerifType };
	script_primary?: ClassificationItem & { value: ScriptTag };
	vox_atypi_class?: ClassificationItem & { value: VoxATypiClass };
	historical_model?: ClassificationItem & { value: HistoricalModel }; // alias v1
	historical_era?: ClassificationItem & { value: HistoricalEra };
}

export interface SummaryOutput {
	description: string; // 1–2 sentences, neutral
	variable_axes_note?: string;
}

export interface AIOutputEnvelope {
	taxonomy_version: string; // "1.0.0"
	model_id: string;
	prompt_version: string;
	classification?: VisualClassification;
	summary?: SummaryOutput;
	// Overall classification confidence (optional)
	confidence?: ConfidenceInfo;
}

// ---- Minimal JSON Schemas (for function calling / validation) ----
export const ClassificationSchema = {
	type: "object",
	properties: {
		style_primary: {
			type: "object",
			properties: {
				value: { type: "string", enum: [...STYLE_PRIMARY] },
				confidence: { type: "number", minimum: 0, maximum: 1 },
				evidence_keys: { type: "array", items: { type: "string" } },
			},
			required: ["value", "confidence"],
		},
		substyle: {
			type: "object",
			properties: {
				value: { type: "string", enum: [...SUBSTYLE] },
				confidence: { type: "number", minimum: 0, maximum: 1 },
				evidence_keys: { type: "array", items: { type: "string" } },
			},
		},
		moods: {
			type: "array",
			items: {
				type: "object",
				properties: {
					value: { type: "string", enum: [...MOODS] },
					confidence: { type: "number", minimum: 0, maximum: 1 },
					evidence_keys: { type: "array", items: { type: "string" } },
				},
				required: ["value", "confidence"],
			},
		},
		use_cases: {
			type: "array",
			items: {
				type: "object",
				properties: {
					value: { type: "string", enum: [...USE_CASES] },
					confidence: { type: "number", minimum: 0, maximum: 1 },
					evidence_keys: { type: "array", items: { type: "string" } },
				},
				required: ["value", "confidence"],
			},
		},
		negative_tags: { type: "array", items: { type: "string" } },
		warnings: { type: "array", items: { type: "string", enum: [...WARNINGS] } },
		serif_type: {
			type: "object",
			properties: {
				value: { type: "string", enum: [...SERIF_TYPE] },
				confidence: { type: "number", minimum: 0, maximum: 1 },
				evidence_keys: { type: "array", items: { type: "string" } },
			},
		},
		script_primary: {
			type: "object",
			properties: {
				value: { type: "string", enum: [...SCRIPT_TAGS] },
				confidence: { type: "number", minimum: 0, maximum: 1 },
				evidence_keys: { type: "array", items: { type: "string" } },
			},
		},
		vox_atypi_class: {
			type: "object",
			properties: {
				value: { type: "string", enum: [...VOX_ATYPI_CLASS] },
				confidence: { type: "number", minimum: 0, maximum: 1 },
				evidence_keys: { type: "array", items: { type: "string" } },
			},
		},
		historical_model: {
			type: "object",
			properties: {
				value: { type: "string", enum: [...HISTORICAL_MODEL] },
				confidence: { type: "number", minimum: 0, maximum: 1 },
				evidence_keys: { type: "array", items: { type: "string" } },
			},
		},
		historical_era: {
			type: "object",
			properties: {
				value: { type: "string", enum: [...HISTORICAL_ERA] },
				confidence: { type: "number", minimum: 0, maximum: 1 },
				evidence_keys: { type: "array", items: { type: "string" } },
			},
		},
	},
	required: ["style_primary"],
} as const;

export const SummarySchema = {
	type: "object",
	properties: {
		description: { type: "string" },
		variable_axes_note: { type: "string" },
	},
	required: ["description"],
} as const;

// ---- Foundational (Stage‑1) outputs & provenance (Stage‑4) ----
export interface OpticalRangeInfo {
	numeric?: {
		minPt?: number;
		maxPt?: number;
	};
	bucket: "caption" | "text" | "subhead" | "display" | "unknown";
}

export interface FoundationalFacts {
	feature_tags?: FeatureTag[]; // OT tags uppercase (or 'cust_*'); deduped & sorted
	serif_presence?: SerifPresence; // CV detection; default 'unknown'
	axis_roles?: Record<string, AxisRole>; // axis tag -> role
	color_font_format?: ColorFontFormat;
	rendering_engine_profile?: RenderingEngineProfile;
	optical_range?: OpticalRangeInfo; // numeric + derived bucket
}

export interface ProvenanceInfo {
	source_type?: ProvenanceSourceType; // domain classification
	foundry_type?: FoundryType;
	distribution_channel?: DistributionChannel;
	license_type?: LicenseType;
	license_flags?: LicenseFlag[];
	source_rank?: number; // 0..1
}

export interface OrchestrationState {
	upload_state?: UploadState;
	job_outcome?: JobOutcome;
	duplicate_resolution?: DuplicateResolution;
	normalization_change_reason?: NormalizationChangeReason;
}

// Convenience guard helpers (lightweight; not exhaustive schema validation)
export function clamp01(value: number | undefined): number | undefined {
	if (value == null) return undefined;
	if (Number.isNaN(value)) return undefined;
	if (value < 0) return 0;
	if (value > 1) return 1;
	return value;
}


