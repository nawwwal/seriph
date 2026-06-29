export type GfCategory = "SERIF" | "SANS_SERIF" | "DISPLAY" | "HANDWRITING" | "MONOSPACE";

export function gfCategory(classification?: string, isMonospace?: boolean): GfCategory {
  if (isMonospace) return "MONOSPACE";
  const c = (classification ?? "").toLowerCase();
  if (c.includes("mono")) return "MONOSPACE";
  if (c.includes("script") || c.includes("hand")) return "HANDWRITING";
  if (c.includes("display") || c.includes("decorative")) return "DISPLAY";
  if (c.includes("sans")) return "SANS_SERIF";
  if (c.includes("serif")) return "SERIF";
  return "SANS_SERIF";
}
