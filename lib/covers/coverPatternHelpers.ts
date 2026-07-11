export const W = 240;
export const H = 100;

export const r = (v: number, p = 2) => Math.round(v * 10 ** p) / 10 ** p;
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const op = (v: number) => r(clamp(v, 0.08, 0.38));

export function rngFrom(seed: number): () => number {
  let state = seed || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

export const ink = (o: number) => `fill="currentColor" opacity="${op(o)}"`;
export const stroke = (o: number, w: number) =>
  `fill="none" stroke="currentColor" stroke-width="${r(w)}" opacity="${op(o)}"`;

export const rect = (x: number, y: number, w: number, h: number, o: number) =>
  `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" ${ink(o)} />`;

export const circle = (cx: number, cy: number, rad: number, o: number) =>
  `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rad)}" ${ink(o)} />`;

export const path = (d: string, o: number) => `<path d="${d}" ${ink(o)} />`;

export const line = (x1: number, y1: number, x2: number, y2: number, o: number, w: number) =>
  `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" ${stroke(o, w)} />`;
