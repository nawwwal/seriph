import type { CoverDna } from '@/lib/covers/coverDna';

const WIDTH = 240;

const round = (value: number, places = 3) => Math.round(value * 10 ** places) / 10 ** places;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const opacity = (value: number) => round(clamp(value, 0.06, 0.42));
const filled = (tag: string, geometry: string, value: number) =>
  `<${tag} ${geometry} fill="currentColor" opacity="${opacity(value)}" />`;
const outlined = (tag: string, geometry: string, value: number, width: number) =>
  `<${tag} ${geometry} fill="none" stroke="currentColor" stroke-width="${round(width)}" opacity="${opacity(value)}" />`;
const line = (x1: number, y1: number, x2: number, y2: number, value: number, width: number) =>
  outlined('line', `x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}"`, value, width);

function addFoldedFacets(parts: string[], dna: CoverDna): void {
  const x = 150 + (dna.seed % 17);
  const y = 16 + ((dna.seed >>> 4) % 17);
  const center = `${x + 46},${y + 27}`;
  parts.push(filled('polygon', `points="${x},${y} ${WIDTH},0 ${center}"`, dna.contrast));
  parts.push(filled('polygon', `points="${x},${y} ${center} ${x + 16},2"`, dna.contrast * 0.55));
  parts.push(filled('polygon', `points="${center} ${WIDTH},0 ${WIDTH},78"`, dna.contrast * 0.78));
  parts.push(filled('polygon', `points="${center} ${WIDTH},78 ${x + 24},88"`, dna.contrast * 0.42));
}

function addConcentricPortals(parts: string[], dna: CoverDna): void {
  const cx = 192 + (dna.seed % 9);
  const cy = 36 + ((dna.seed >>> 5) % 7);
  for (let index = 0; index < 5; index += 1) {
    const rx = 66 - index * 11;
    const ry = 47 - index * 8;
    parts.push(outlined('ellipse', `cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"`, dna.contrast * (1 - index * 0.09), dna.ruleWeight * 4));
  }
}

function addRibbonCurves(parts: string[], dna: CoverDna): void {
  const startY = 12 + (dna.seed % 9);
  for (let index = 0; index < 4; index += 1) {
    const y = startY + index * dna.rhythm[0];
    const path = `d="M 126 ${round(y)} C 154 ${round(y + dna.angle)} 180 ${round(y - dna.angle)} 204 ${round(y + 4)} S 232 ${round(y + 15)} 248 ${round(y - 5)}"`;
    parts.push(outlined('path', `${path} stroke-linecap="round"`, dna.contrast * (1 - index * 0.12), dna.ruleWeight * 5));
  }
}

function addSteppedBands(parts: string[], dna: CoverDna): void {
  const phase = dna.seed % 9;
  for (let index = 0; index < 6; index += 1) {
    const x = 130 + index * 11 + phase;
    const y = 7 + index * 13;
    parts.push(filled('rect', `x="${x}" y="${y}" width="${WIDTH - x}" height="${round(dna.rhythm[2] + 5)}"`, dna.contrast * (1 - index * 0.08)));
  }
}

function addRadialBurst(parts: string[], dna: CoverDna): void {
  const cx = 198 + (dna.seed % 8);
  const cy = 31 + ((dna.seed >>> 3) % 8);
  const count = 11 + Math.floor(dna.density * 5);
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI * 0.9 + (index / (count - 1)) * Math.PI * 1.65;
    const length = index % 2 === 0 ? 66 : 50;
    parts.push(line(cx + Math.cos(angle) * 12, cy + Math.sin(angle) * 12, cx + Math.cos(angle) * length, cy + Math.sin(angle) * length, dna.contrast, dna.ruleWeight * 2.2));
  }
}

function addModularDotsBars(parts: string[], dna: CoverDna): void {
  const phase = dna.seed % 7;
  for (let index = 0; index < 9; index += 1) {
    const x = 145 + (index % 3) * 32 + phase;
    const y = 14 + Math.floor(index / 3) * 29;
    const value = dna.contrast * (1 - (index % 3) * 0.12);
    if ((index + dna.seed) % 3 === 0) parts.push(filled('rect', `x="${x - 10}" y="${y - 4}" width="27" height="9"`, value));
    else parts.push(filled('circle', `cx="${x}" cy="${y}" r="${round(5 + dna.rhythm[2] * 0.45)}"`, value));
  }
}

const renderers: Record<CoverDna['pattern'], (parts: string[], dna: CoverDna) => void> = {
  'folded-facets': addFoldedFacets,
  'concentric-portals': addConcentricPortals,
  'ribbon-curves': addRibbonCurves,
  'stepped-bands': addSteppedBands,
  'radial-bursts': addRadialBurst,
  'modular-dots-bars': addModularDotsBars,
};

export function renderCoverSvgParts(dna: CoverDna): string[] {
  const parts: string[] = [];
  renderers[dna.pattern](parts, dna);
  return parts;
}
