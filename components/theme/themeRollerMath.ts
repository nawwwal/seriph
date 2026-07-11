import type { ThemeMeta } from '@/lib/theme/themeMeta';

/** How many faces are visible (center ± 2). */
export const ROLLER_VIEW_ROWS = 5;
export const ROLLER_MID = 2;
/** Vertical pitch between faces (px). */
export const ROLLER_ROW_PX = 40;

export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function themeIndex(items: readonly ThemeMeta[], value: string): number {
  const found = items.findIndex((item) => item.value === value);
  return found >= 0 ? found : 0;
}

/** Shortest signed distance from continuous `position` to item `index` on a ring. */
export function circularOffset(index: number, position: number, count: number): number {
  if (count <= 0) return 0;
  let delta = index - position;
  delta -= count * Math.round(delta / count);
  return delta;
}

/** Items near the drum center for a continuous position. */
export function visibleOffsets(
  count: number,
  position: number,
  halfWindow = ROLLER_MID,
): Array<{ index: number; offset: number }> {
  if (count <= 0) return [];
  const slots: Array<{ index: number; offset: number }> = [];
  for (let i = 0; i < count; i += 1) {
    const offset = circularOffset(i, position, count);
    if (Math.abs(offset) <= halfWindow + 0.51) {
      slots.push({ index: i, offset });
    }
  }
  return slots.sort((a, b) => a.offset - b.offset);
}

export function snapPosition(position: number): number {
  return Math.round(position);
}
