import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '@/lib/upload/boundedConcurrency';

describe('mapWithConcurrency', () => {
  it('keeps result order while limiting concurrent work', async () => {
    let active = 0;
    let maxActive = 0;
    const results = await mapWithConcurrency([3, 1, 2], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return value * 2;
    });

    expect(results).toEqual([6, 2, 4]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
