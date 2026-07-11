export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function snap(raw: number, min: number, max: number, step: number) {
  if (step <= 0) return clamp(raw, min, max);
  const snapped = Math.round((raw - min) / step) * step + min;
  return clamp(Number(snapped.toFixed(6)), min, max);
}

export function valueToPct(value: number, min: number, max: number) {
  const span = max - min || 1;
  return clamp(((value - min) / span) * 100, 0, 100);
}

export function clientXToValue(clientX: number, rect: DOMRect, min: number, max: number, step: number) {
  const t = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  return snap(min + t * (max - min || 1), min, max, step);
}
