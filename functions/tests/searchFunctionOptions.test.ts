import { describe, expect, it } from 'vitest';
import { SEARCH_FUNCTION_OPTIONS } from '../src/options';

describe('search function options', () => {
  it('runs the sole search handler in us-central1', () => {
    expect(SEARCH_FUNCTION_OPTIONS.region).toBe('us-central1');
  });
});
