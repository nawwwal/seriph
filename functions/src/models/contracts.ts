// Taxonomy and contract definitions for Font Intelligence System v1 (taxonomy_version: 1.0.0)
// This module centralizes enum canons, TypeScript types, and JSON Schemas consumed by the AI pipeline.

export const TAXONOMY_VERSION = "1.0.0";

// ---- Enumerations (frozen) ----
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


