import type { CoverDna } from '@/lib/covers/coverDna';
import { W, H, rngFrom, rect, circle, line } from '@/lib/covers/coverPatternHelpers';

export function pinstripe(dna: CoverDna): string[] {
  const parts: string[] = [];
  const gap = 5 + dna.rhythm[0] * 0.35;
  for (let x = 100; x < W + 10; x += gap) {
    parts.push(line(x, 0, x, H, dna.contrast * 0.85, dna.ruleWeight * 0.9));
  }
  return parts;
}

export function twinDisc(dna: CoverDna): string[] {
  const rng = rngFrom(dna.seed);
  const cx = 160 + rng() * 40;
  const cy = 45 + rng() * 20;
  const rad = 36 + rng() * 24;
  return [
    circle(cx, cy, rad, dna.contrast * 0.7),
    circle(cx + rad * 0.55, cy + rad * 0.1, rad * 0.75, dna.contrast * 0.45),
  ];
}

export function nest(dna: CoverDna): string[] {
  const rng = rngFrom(dna.seed);
  const cx = 165 + rng() * 30;
  const cy = 50;
  const parts: string[] = [];
  for (let i = 4; i >= 1; i -= 1) {
    const s = 14 + i * 12;
    parts.push(rect(cx - s / 2, cy - s / 2, s, s, dna.contrast * (0.18 + (4 - i) * 0.1)));
  }
  return parts;
}

export function leading(dna: CoverDna): string[] {
  const rng = rngFrom(dna.seed);
  const parts: string[] = [];
  const gap = 7 + rng() * 3;
  const left = 108 + rng() * 20;
  for (let y = 14; y < H - 10; y += gap) {
    const w = 60 + rng() * 70;
    parts.push(line(left, y, left + w, y, dna.contrast * 0.9, dna.ruleWeight * 1.1));
  }
  return parts;
}

export function sweep(dna: CoverDna): string[] {
  const rng = rngFrom(dna.seed);
  const cx = W + 5;
  const cy = rng() > 0.5 ? -5 : H + 5;
  const rad = 70 + rng() * 50;
  return [circle(cx, cy, rad, dna.contrast * 0.88)];
}
