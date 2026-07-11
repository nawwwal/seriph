import { describe, expect, it } from 'vitest';
import { filterFamiliesByInitial } from '@/components/home/alphabetFilter';

const families = [
  { id: 'z', name: 'Zed' },
  { id: 'a-upper', name: 'Atlas' },
  { id: 'symbol', name: '123 Sans' },
  { id: 'a-lower', name: 'amber' },
];

describe('home alphabet filter', () => {
  it('returns the original list for ALL', () => {
    expect(filterFamiliesByInitial(families, 'ALL')).toBe(families);
  });

  it('matches initials case-insensitively and keeps input order', () => {
    expect(filterFamiliesByInitial(families, 'A')).toEqual([
      families[1],
      families[3],
    ]);
  });

  it('preserves matching family object identity', () => {
    const result = filterFamiliesByInitial(families, 'Z');

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(families[0]);
  });

  it('does not place non-letter family names under a letter', () => {
    expect(filterFamiliesByInitial(families, 'A')).not.toContain(families[2]);
    expect(filterFamiliesByInitial(families, 'Z')).not.toContain(families[2]);
  });
});
