const WORD_RE = /[\p{L}\p{N}]+/gu;

export function normalizeSearchInput(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(WORD_RE)?.join(' ') ?? '';
}

export function uniqueSearchTokens(value: string): string[] {
  return [...new Set(normalizeSearchInput(value).split(' ').filter((token) => token.length > 1))];
}

export function searchTrigrams(value: string): Set<string> {
  const normalized = `  ${normalizeSearchInput(value)}  `;
  const grams = new Set<string>();
  for (let index = 0; index <= normalized.length - 3; index += 1) grams.add(normalized.slice(index, index + 3));
  return grams;
}

export function diceFromTrigrams(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const gram of left) if (right.has(gram)) overlap += 1;
  return (2 * overlap) / (left.size + right.size);
}
