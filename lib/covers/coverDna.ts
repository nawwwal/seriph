import type { ShelfFamily } from '@/models/shelf.models';
export { renderCoverSvgParts } from '@/lib/covers/coverPatternRender';

export type CoverGrammar = 'editorial-pattern';
export type CoverPattern =
  | 'folded-facets'
  | 'concentric-portals'
  | 'ribbon-curves'
  | 'stepped-bands'
  | 'radial-bursts'
  | 'modular-dots-bars';

export interface CoverDna {
  seed: number;
  grammar: CoverGrammar;
  pattern: CoverPattern;
  angle: number;
  density: number;
  contrast: number;
  ruleWeight: number;
  rhythm: number[];
  specimenScale: number;
  specimenX: number;
  specimenY: number;
}

const PATTERNS: CoverPattern[] = [
  'folded-facets',
  'concentric-portals',
  'ribbon-curves',
  'stepped-bands',
  'radial-bursts',
  'modular-dots-bars',
];

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: number): () => number {
  let state = seed || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

const round = (value: number, places = 3) => Math.round(value * 10 ** places) / 10 ** places;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function deriveCoverDna(family: ShelfFamily, coverSeed = 0): CoverDna {
  const seed = hashString(`${family.normalizedName || family.name}|${coverSeed}`);
  const rng = createRng(seed);
  const density = round(clamp(0.44 + rng() * 0.38, 0.44, 0.82));
  return {
    seed,
    grammar: 'editorial-pattern',
    pattern: PATTERNS[(seed >>> 8) % PATTERNS.length] ?? 'folded-facets',
    angle: round(rng() > 0.5 ? 12 + rng() * 18 : -18 - rng() * 12),
    density,
    contrast: round(0.16 + rng() * 0.18),
    ruleWeight: round(0.42 + rng() * 0.34),
    rhythm: [round(12 + rng() * 8), round(18 + rng() * 18), round(3 + rng() * 5)],
    specimenScale: 1,
    specimenX: 16,
    specimenY: 46,
  };
}
