import type { ShelfFamily } from '@/models/shelf.models';
export { renderCoverSvgParts } from '@/lib/covers/coverPatternRender';

export type CoverGrammar = 'swiss-poster';
export type CoverPattern =
  | 'disc'
  | 'bars'
  | 'spine'
  | 'band'
  | 'block'
  | 'pinstripe'
  | 'twin-disc'
  | 'nest'
  | 'leading'
  | 'sweep';

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
  rareAccent: boolean;
}

const PATTERNS: CoverPattern[] = [
  'disc',
  'bars',
  'spine',
  'band',
  'block',
  'pinstripe',
  'twin-disc',
  'nest',
  'leading',
  'sweep',
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
  const seed = hashString([family.name, family.normalizedName || family.name, String(coverSeed)].join('|'));
  const rng = createRng(seed);
  return {
    seed,
    grammar: 'swiss-poster',
    pattern: PATTERNS[Math.floor(rng() * PATTERNS.length)] ?? 'disc',
    angle: round(8 + rng() * 28),
    density: round(clamp(0.5 + rng() * 0.3, 0.5, 0.85)),
    contrast: round(0.2 + rng() * 0.14),
    ruleWeight: round(0.85 + rng() * 0.5),
    rhythm: [round(4 + rng() * 6), round(12 + rng() * 16), round(3 + rng() * 4)],
    specimenScale: 1,
    specimenX: 16,
    specimenY: 46,
    rareAccent: false,
  };
}
