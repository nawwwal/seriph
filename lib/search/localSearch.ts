import type { SearchIndexItem, SearchResultItem } from '@/models/search.models';
import { prepareSearchItem, prepareSearchQuery, type PreparedSearchItem, type PreparedSearchQuery } from '@/lib/search/preparedSearch';
import { diceFromTrigrams, normalizeSearchInput } from '@/lib/search/searchText';

export { normalizeSearchInput } from '@/lib/search/searchText';

const MIN_SCORE = 0.25;
const EMPTY_GRAMS = new Set<string>();

function tokenScore(queryTokens: string[], itemTokens: string[], itemSet: Set<string>): number {
  if (!queryTokens.length) return 0;
  let score = 0;
  for (const queryToken of queryTokens) {
    if (itemSet.has(queryToken)) score += 1;
    else if (itemTokens.some((token) => token.startsWith(queryToken))) score += 0.72;
    else if (itemTokens.some((token) => token.includes(queryToken))) score += 0.48;
  }
  return score / queryTokens.length;
}

function cheapNameScore(query: PreparedSearchQuery, item: PreparedSearchItem): number {
  if (query.text === item.name || query.text === item.slug) return 1;
  if (item.name.startsWith(query.text) || item.slug.startsWith(query.text)) return 0.94;
  if (item.name.includes(query.text) || item.slug.includes(query.text)) return 0.82;
  return 0;
}

function cheapScore(query: PreparedSearchQuery, item: PreparedSearchItem): number {
  const primary = tokenScore(query.tokens, item.primaryTokens, item.primarySet);
  const secondary = tokenScore(query.tokens, item.secondaryTokens, item.secondarySet);
  const lexical = tokenScore(query.tokens, item.allTokens, item.allSet);
  return Math.min(1, Math.max(cheapNameScore(query, item), primary * 0.96, secondary * 0.5, lexical * 0.38));
}

function bestTokenDice(query: PreparedSearchQuery, tokens: string[], item: PreparedSearchItem): number {
  let score = 0;
  for (const queryToken of query.tokens) {
    const queryGrams = query.tokenGrams.get(queryToken);
    if (!queryGrams) continue;
    let best = 0;
    for (const token of tokens) best = Math.max(best, diceFromTrigrams(queryGrams, item.tokenGrams.get(token) ?? EMPTY_GRAMS));
    score += best >= 0.58 ? best : 0;
  }
  return score / query.tokens.length;
}

function fuzzyScore(query: PreparedSearchQuery, item: PreparedSearchItem): number {
  const name = Math.max(diceFromTrigrams(query.grams, item.nameGrams), diceFromTrigrams(query.grams, item.slugGrams)) * 0.78;
  const tokens = Math.max(
    bestTokenDice(query, item.primaryTokens, item) * 0.72,
    bestTokenDice(query, item.secondaryTokens, item) * 0.38
  );
  return Math.max(name, tokens);
}

export function scoreSearchItem(queryText: string, item: SearchIndexItem): number {
  const query = prepareSearchQuery(queryText);
  if (!query) return 0;
  const prepared = prepareSearchItem(item);
  return Math.min(1, Math.max(cheapScore(query, prepared), fuzzyScore(query, prepared)));
}

export function rankLocalSearch(items: SearchIndexItem[], queryText: string, limit = 24): SearchResultItem[] {
  const query = prepareSearchQuery(queryText);
  if (!query) return [];
  const ranked: Array<{ item: SearchIndexItem; score: number }> = [];
  const fuzzyPool: Array<{ prepared: PreparedSearchItem; score: number }> = [];

  for (const rawItem of items) {
    const item = prepareSearchItem(rawItem);
    const score = cheapScore(query, item);
    if (score >= MIN_SCORE) ranked.push({ item: rawItem, score });
    else if (ranked.length < limit) fuzzyPool.push({ prepared: item, score });
  }

  if (ranked.length < limit && query.tokens.some((token) => token.length >= 3)) {
    for (const { prepared, score } of fuzzyPool) {
      const nextScore = Math.max(score, fuzzyScore(query, prepared));
      if (nextScore >= MIN_SCORE) ranked.push({ item: prepared.item, score: nextScore });
    }
  }

  return ranked
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map(({ item, score }) => ({ ...item, score, source: 'local' }));
}

export function mergeSearchResults(primary: SearchResultItem[], fallback: SearchResultItem[], limit = 24): SearchResultItem[] {
  const seen = new Set<string>();
  const merged: SearchResultItem[] = [];
  for (const item of [...primary, ...fallback]) {
    const key = item.slug || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}
