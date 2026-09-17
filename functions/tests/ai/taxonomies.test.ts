import { describe, it, expect } from 'vitest';
import { getValidSubtypes, isValidSubtype, isValidMood, isValidUseCase, parseMood, parseUseCase } from '../../src/ai/taxonomies';

describe('taxonomies helpers', () => {
  it('returns valid subtypes for main class', () => {
    const subs = getValidSubtypes('sans');
    expect(Array.isArray(subs)).toBe(true);
    expect(subs.length).toBeGreaterThan(0);
  });

  it('validates subtypes correctly', () => {
    expect(isValidSubtype('serif', 'oldstyle')).toBe(true);
    expect(isValidSubtype('serif', 'bitmap')).toBe(false);
  });

  it('validates moods and use cases', () => {
    expect(isValidMood('neutral')).toBe(true);
    expect(isValidMood('made_up_mood')).toBe(false);
    expect(parseMood("Warm")).toBe("warm");
    expect(parseUseCase("body text")).toBe("body_text");
    expect(isValidUseCase('made_up_usecase')).toBe(false);
  });
});


