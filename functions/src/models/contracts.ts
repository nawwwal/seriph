// Taxonomy enums consumed by the rebuilt AI pipeline (via ai/taxonomies.ts).
// Pure declaration/data file — exempt from the <100-line guideline.
// Trimmed from the legacy v1 contract set to only the enums still in use.

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
