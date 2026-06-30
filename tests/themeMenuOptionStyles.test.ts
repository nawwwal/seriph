import { describe, expect, it } from 'vitest';
import { themeMenuOptionClassName } from '@/components/theme/themeMenuOptionStyles';

describe('themeMenuOptionClassName', () => {
  it('preserves selected option styling', () => {
    expect(themeMenuOptionClassName({ highlighted: false, selected: true })).toBe(
      'flex h-10 w-full cursor-pointer items-center justify-between px-3 text-left uppercase text-sm font-bold leading-none ink-bg'
    );
  });

  it('preserves highlighted non-selected option styling', () => {
    expect(themeMenuOptionClassName({ highlighted: true, selected: false })).toBe(
      'flex h-10 w-full cursor-pointer items-center justify-between px-3 text-left uppercase text-sm font-bold leading-none btn-ink bg-[var(--muted)]'
    );
  });
});
