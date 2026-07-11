import type { CoverDna } from '@/lib/covers/coverDna';
import { W, H, r, rngFrom, rect, circle, path, line } from '@/lib/covers/coverPatternHelpers';

export function disc(dna: CoverDna): string[] {
  const rng = rngFrom(dna.seed);
  const cx = 175 + rng() * 50;
  const cy = 20 + rng() * 60;
  const rad = 48 + rng() * 40;
  return [
    circle(cx, cy, rad, dna.contrast * 0.95),
    circle(cx - rad * 0.15, cy - rad * 0.12, rad * 0.35, dna.contrast * 0.35),
  ];
}

export function bars(dna: CoverDna): string[] {
  const rng = rngFrom(dna.seed);
  const parts: string[] = [];
  const n = 3 + Math.floor(rng() * 2);
  const totalH = 48 + rng() * 20;
  const gap = 5 + rng() * 4;
  const barH = (totalH - gap * (n - 1)) / n;
  const top = (H - totalH) / 2 + rng() * 8 - 4;
  const left = 110 + rng() * 30;
  const width = W - left - 12;
  for (let i = 0; i < n; i += 1) {
    const w = width * (0.55 + rng() * 0.45);
    parts.push(rect(left + (width - w) * (rng() > 0.5 ? 1 : 0), top + i * (barH + gap), w, barH, dna.contrast * (0.55 + i * 0.12)));
  }
  return parts;
}

export function spine(dna: CoverDna): string[] {
  const rng = rngFrom(dna.seed);
  const parts: string[] = [];
  const n = 5 + Math.floor(dna.density * 4);
  const left = 130 + rng() * 40;
  const gap = 7 + rng() * 5;
  for (let i = 0; i < n; i += 1) {
    const w = 2 + (i / n) * 10;
    parts.push(rect(left + i * gap, 12, w, H - 24, dna.contrast * (0.4 + (i / n) * 0.45)));
  }
  return parts;
}

export function band(dna: CoverDna): string[] {
  const rng = rngFrom(dna.seed);
  const thick = 28 + rng() * 36;
  const y = -20 + rng() * 40;
  return [
    path(
      `M 80 ${r(y)} L ${W + 20} ${r(y + dna.angle * 0.8)} L ${W + 20} ${r(y + dna.angle * 0.8 + thick)} L 80 ${r(y + thick)} Z`,
      dna.contrast * 0.85
    ),
  ];
}

export function block(dna: CoverDna): string[] {
  const rng = rngFrom(dna.seed);
  const w = 70 + rng() * 90;
  const h = 50 + rng() * 60;
  const x = W - w + 10 + rng() * 20;
  const y = rng() > 0.5 ? -10 : H - h + 10;
  return [rect(x, y, w, h, dna.contrast * 0.9)];
}
