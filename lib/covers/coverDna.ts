import type { ShelfFamily } from '@/models/shelf.models';
export { renderCoverSvgParts } from '@/lib/covers/coverPatternRender';

export type CoverGrammar = 'editorial-pattern';
export type CoverPattern =
  | 'pinstripe'
  | 'diagonal-stripe'
  | 'ruled-grid'
  | 'proof-bars'
  | 'edge-bands'
  | 'dot-screen'
  | 'column-rules'
  | 'registration-marks';

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
  'pinstripe',
  'diagonal-stripe',
  'ruled-grid',
  'proof-bars',
  'edge-bands',
  'dot-screen',
  'column-rules',
  'registration-marks',
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
  const seed = hashString([
    family.id,
    family.normalizedName,
    family.name,
    family.classification,
    family.styleCount,
    family.isVariable ? 'variable' : 'static',
    coverSeed,
  ].join('|'));
  const rng = createRng(seed);
  const density = round(clamp(0.44 + rng() * 0.28 + Math.min(family.styleCount, 18) * 0.006, 0.44, 0.82));
  return {
    seed,
    grammar: 'editorial-pattern',
    pattern: PATTERNS[Math.floor(rng() * PATTERNS.length)] ?? 'pinstripe',
    angle: round(rng() > 0.5 ? 12 + rng() * 18 : -18 - rng() * 12),
    density,
    contrast: round(0.16 + rng() * 0.18),
    ruleWeight: round(0.42 + rng() * 0.34),
    rhythm: [round(5 + (1 - density) * 8), round(18 + rng() * 26), round(3 + rng() * 5)],
    specimenScale: 1,
    specimenX: 16,
    specimenY: 46,
    rareAccent: rng() > 0.78,
  };
}
