// Google Fonts weight tables + lookups. Data-heavy companion to canonicalize.ts.

/** Canonical Google Fonts weight name <-> usWeightClass number. */
export const GF_WEIGHTS: ReadonlyArray<{ name: string; value: number }> = [
  { name: "Thin", value: 100 },
  { name: "ExtraLight", value: 200 },
  { name: "Light", value: 300 },
  { name: "Regular", value: 400 },
  { name: "Medium", value: 500 },
  { name: "SemiBold", value: 600 },
  { name: "Bold", value: 700 },
  { name: "ExtraBold", value: 800 },
  { name: "Black", value: 900 },
  { name: "ExtraBlack", value: 1000 },
];

/** OpenType registered axis tags (lowercase). Everything else is "custom". */
export const REGISTERED_AXES = new Set(["ital", "opsz", "slnt", "wdth", "wght"]);

/** Tokens (lowercased, de-spaced) used to recover a weight from a style string. */
export const WEIGHT_TOKENS: ReadonlyArray<{ token: string; value: number }> = [
  { token: "extrablack", value: 1000 },
  { token: "ultrablack", value: 1000 },
  { token: "extrabold", value: 800 },
  { token: "ultrabold", value: 800 },
  { token: "semibold", value: 600 },
  { token: "demibold", value: 600 },
  { token: "extralight", value: 200 },
  { token: "ultralight", value: 200 },
  { token: "thin", value: 100 },
  { token: "hairline", value: 100 },
  { token: "light", value: 300 },
  { token: "medium", value: 500 },
  { token: "black", value: 900 },
  { token: "heavy", value: 900 },
  { token: "bold", value: 700 },
  { token: "regular", value: 400 },
  { token: "normal", value: 400 },
  { token: "book", value: 400 },
];

/** Snap an arbitrary usWeightClass to the nearest canonical GF weight. */
export function snapWeight(value: number): number {
  let best = GF_WEIGHTS[0]!;
  for (const w of GF_WEIGHTS) {
    if (Math.abs(w.value - value) < Math.abs(best.value - value)) best = w;
  }
  return best.value;
}

export function weightNameFromNumber(value: number): string {
  const exact = GF_WEIGHTS.find((w) => w.value === value);
  return (exact ?? GF_WEIGHTS.find((w) => w.value === snapWeight(value))!).name;
}
