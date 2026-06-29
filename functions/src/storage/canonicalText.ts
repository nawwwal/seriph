export function cleanName(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/\s+/g, " ");
  return trimmed || undefined;
}

export function splitStyleWords(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactStyleSuffix(value: string): string {
  return splitStyleWords(value).replace(/[^A-Za-z0-9]/g, "");
}

export function isRegularStyle(value: string | undefined): boolean {
  const compact = (value ?? "").toLowerCase().replace(/[\s_-]+/g, "");
  return compact === "" || compact === "regular" || compact === "roman";
}

export function normalizeStyleName(value: string | undefined): string {
  const cleaned = splitStyleWords(cleanName(value) ?? "");
  if (!cleaned || isRegularStyle(cleaned)) return "Regular";
  return cleaned
    .replace(/\bRoman\b/gi, "Regular")
    .replace(/\s+/g, " ")
    .trim();
}
