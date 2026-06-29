import type { CoverDna } from '@/lib/covers/coverDna';

const WIDTH = 240;
const HEIGHT = 100;

const round = (value: number, places = 3) => Math.round(value * 10 ** places) / 10 ** places;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const attrs = (opacity: number, width: number) =>
  `fill="none" stroke="currentColor" stroke-width="${round(width)}" opacity="${round(clamp(opacity, 0.06, 0.42))}"`;
const line = (x1: number, y1: number, x2: number, y2: number, o: number, w: number) =>
  `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${attrs(o, w)} />`;
const rect = (x: number, y: number, w: number, h: number, o: number) =>
  `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="currentColor" opacity="${round(o)}" />`;
const circle = (cx: number, cy: number, r: number, o: number) =>
  `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" fill="currentColor" opacity="${round(o)}" />`;

function addStripes(parts: string[], dna: CoverDna, diagonal = false): void {
  const gap = dna.rhythm[0];
  const start = -WIDTH + (dna.seed % Math.ceil(gap));
  const transform = diagonal ? ` transform="rotate(${dna.angle} ${WIDTH / 2} ${HEIGHT / 2})"` : '';
  parts.push(`<g${transform}>`);
  for (let x = start; x < WIDTH * 2; x += gap) parts.push(line(x, -24, x, HEIGHT + 24, dna.contrast, dna.ruleWeight));
  parts.push('</g>');
}

function addGrid(parts: string[], dna: CoverDna): void {
  for (let x = 12 + (dna.seed % 7); x < WIDTH; x += dna.rhythm[1]) parts.push(line(x, 0, x, HEIGHT, dna.contrast, dna.ruleWeight));
  for (let y = 12 + ((dna.seed >>> 4) % 7); y < HEIGHT; y += dna.rhythm[1] * 0.58) parts.push(line(0, y, WIDTH, y, dna.contrast * 0.72, dna.ruleWeight));
}

function addDots(parts: string[], dna: CoverDna): void {
  const gap = dna.rhythm[0] + 3;
  for (let y = 8; y < HEIGHT; y += gap) {
    for (let x = 96 + (y % 2 ? gap / 2 : 0); x < WIDTH; x += gap) parts.push(circle(x, y, dna.ruleWeight * 1.05, dna.contrast));
  }
}

function addRegistration(parts: string[], dna: CoverDna): void {
  for (const [x, y] of [[180, 24], [214, 24], [180, 70], [214, 70]]) {
    parts.push(line(x - 7, y, x + 7, y, dna.contrast, dna.ruleWeight));
    parts.push(line(x, y - 7, x, y + 7, dna.contrast, dna.ruleWeight));
  }
}

export function renderCoverSvgParts(dna: CoverDna): string[] {
  const parts = [line(12, 12, WIDTH - 12, 12, 0.12, dna.ruleWeight), line(12, HEIGHT - 12, WIDTH - 12, HEIGHT - 12, 0.12, dna.ruleWeight)];
  if (dna.pattern === 'pinstripe') addStripes(parts, dna);
  if (dna.pattern === 'diagonal-stripe') addStripes(parts, dna, true);
  if (dna.pattern === 'ruled-grid') addGrid(parts, dna);
  if (dna.pattern === 'dot-screen') addDots(parts, dna);
  if (dna.pattern === 'column-rules') for (let x = 116; x < WIDTH; x += dna.rhythm[1]) parts.push(line(x, 8, x, HEIGHT - 8, dna.contrast, dna.ruleWeight * 1.4));
  if (dna.pattern === 'proof-bars') for (let x = 124; x < WIDTH; x += dna.rhythm[1]) parts.push(rect(x, 10, dna.rhythm[2], HEIGHT - 20, dna.contrast * 0.5));
  if (dna.pattern === 'edge-bands') parts.push(rect(WIDTH - 22, 0, 8, HEIGHT, dna.contrast * 0.52), rect(0, HEIGHT - 18, WIDTH, 5, dna.contrast * 0.36));
  if (dna.pattern === 'registration-marks') addRegistration(parts, dna);
  if (dna.rareAccent) parts.push(line(WIDTH - 58, 50, WIDTH - 22, 50, dna.contrast * 0.88, dna.ruleWeight * 1.2));
  return parts;
}
