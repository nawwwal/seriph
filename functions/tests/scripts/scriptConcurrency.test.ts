import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '../../src/scripts/scriptConcurrency';

describe('script mapWithConcurrency', () => {
  it('keeps order while limiting active work', async () => {
    let active = 0;
    let maxActive = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return value * 10;
    });

    expect(results).toEqual([10, 20, 30, 40]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
