import { describe, expect, it } from 'vitest';
import {
  circularOffset,
  snapPosition,
  themeIndex,
  visibleOffsets,
  wrapIndex,
} from '@/components/theme/themeRollerMath';
import {
  clampVelocity,
  elasticSnapTarget,
  weightForOffset,
} from '@/components/theme/themeRollerMotion';

describe('theme roller math', () => {
  it('wraps indices in both directions', () => {
    expect(wrapIndex(-1, 5)).toBe(4);
    expect(wrapIndex(5, 5)).toBe(0);
  });

  it('uses shortest circular offsets for continuous position', () => {
    expect(circularOffset(0, 0.25, 10)).toBeCloseTo(-0.25);
    expect(circularOffset(9, 0.25, 10)).toBeCloseTo(-1.25);
    expect(circularOffset(1, 0.25, 10)).toBeCloseTo(0.75);
  });

  it('lists faces near the drum center', () => {
    const near = visibleOffsets(10, 0);
    expect(near.map((slot) => slot.index)).toEqual([8, 9, 0, 1, 2]);
    expect(near.find((slot) => slot.index === 0)?.offset).toBe(0);
  });

  it('snaps and resolves theme indices', () => {
    expect(snapPosition(3.4)).toBe(3);
    expect(snapPosition(3.6)).toBe(4);
    const items = [
      { value: 'ink', label: 'Ink', edition: '01' },
      { value: 'noir', label: 'Noir', edition: '02' },
    ] as const;
    expect(themeIndex(items, 'noir')).toBe(1);
    expect(themeIndex(items, 'missing')).toBe(0);
  });

  it('projects elastic snap targets from release velocity', () => {
    expect(clampVelocity(100)).toBe(14);
    expect(elasticSnapTarget(2.1, 0)).toBe(2);
    expect(elasticSnapTarget(2.4, 0)).toBe(2);
    // strong fling forward coasts past midpoint
    expect(elasticSnapTarget(2.1, 8)).toBeGreaterThanOrEqual(3);
  });

  it('thins type weight continuously as faces move away from center', () => {
    expect(weightForOffset(0)).toBe(900);
    expect(weightForOffset(1)).toBe(600);
    expect(weightForOffset(2)).toBe(300);
    expect(weightForOffset(0.5)).toBeCloseTo(750, 5);
    expect(weightForOffset(0.25)).toBeCloseTo(825, 5);
    expect(weightForOffset(-2)).toBe(weightForOffset(2));
  });
});




