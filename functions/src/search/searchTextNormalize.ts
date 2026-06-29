const MAX_TOKEN_COUNT = 80;

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenizeSearchText(parts: Array<string | undefined | null>): string[] {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    const normalized = normalizeSearchText(part.replace(/_/g, " "));
    for (const token of normalized.split(" ")) {
      if (token.length >= 2) tokens.add(token);
    }
  }
  return [...tokens].slice(0, MAX_TOKEN_COUNT);
}
