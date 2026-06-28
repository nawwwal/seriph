/**
 * Parsing for the Google-Fonts-style CSS API query grammar (subset):
 *   Family · Family:wght@400 · Family:wght@400;700 · Family:wght@400..700
 *   Family:ital,wght@0,400;1,700 · Family:ital@1
 */
import { familySlug } from "../storage/canonicalize";

export interface RequestedStyle {
  italic: boolean;
  /** A single weight, or a [min,max] range for variable requests. */
  weight: number | [number, number];
}

export interface FamilyRequest {
  family: string;
  slug: string;
  styles: RequestedStyle[];
}

const DEFAULT_DISPLAY = "swap";
const VALID_DISPLAY = new Set(["auto", "block", "swap", "fallback", "optional"]);

/** Parse a single `family=` spec value into a FamilyRequest. */
export function parseFamilySpec(spec: string): FamilyRequest {
  const [familyRaw, axisSpec] = spec.split(":");
  const family = familyRaw.replace(/\+/g, " ").trim();
  const base: FamilyRequest = { family, slug: familySlug(family), styles: [] };

  if (!axisSpec) {
    base.styles.push({ italic: false, weight: 400 });
    return base;
  }

  const [axisPart, tuplePart] = axisSpec.split("@");
  const axes = axisPart.split(",").map((a) => a.trim());
  const hasItal = axes.includes("ital");
  const wghtIdx = axes.indexOf("wght");
  const italIdx = axes.indexOf("ital");

  const tuples = (tuplePart ?? "400").split(";").map((t) => t.trim()).filter(Boolean);
  for (const tuple of tuples) {
    const parts = tuple.split(",").map((p) => p.trim());
    const italic = hasItal ? parts[italIdx] === "1" : false;
    const wghtToken = wghtIdx >= 0 ? parts[wghtIdx] : parts[parts.length - 1];

    let weight: number | [number, number] = 400;
    if (wghtToken && wghtToken.includes("..")) {
      const [lo, hi] = wghtToken.split("..").map((n) => parseInt(n, 10));
      weight = [lo, hi];
    } else if (wghtToken) {
      weight = parseInt(wghtToken, 10) || 400;
    }
    base.styles.push({ italic, weight });
  }
  if (base.styles.length === 0) base.styles.push({ italic: false, weight: 400 });
  return base;
}

/** Parse a full css2 query (already-decoded params) into family requests. */
export function parseCss2Query(params: URLSearchParams): { families: FamilyRequest[]; display: string } {
  const families = params.getAll("family").map(parseFamilySpec);
  const displayRaw = params.get("display") ?? DEFAULT_DISPLAY;
  const display = VALID_DISPLAY.has(displayRaw) ? displayRaw : DEFAULT_DISPLAY;
  return { families, display };
}
