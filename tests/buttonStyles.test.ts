import { describe, expect, it } from 'vitest';
import { buttonClassName } from '@/components/ui/buttonStyles';
import { cn } from '@/lib/utils/cn';

describe('button styles', () => {
  it('joins conditional classes without changing order', () => {
    expect(cn('rule', false && 'missing', undefined, 'btn-ink', null, 'ink-bg')).toBe('rule btn-ink ink-bg');
  });

  it('preserves Seriph editorial action button classes', () => {
    expect(buttonClassName({ size: 'md', tone: 'default' })).toBe(
      'uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm sm:text-base btn-ink',
    );
  });

  it('preserves active nav button classes', () => {
    expect(buttonClassName({ size: 'nav', tone: 'active' })).toBe(
      'uppercase font-bold rule px-3 py-1 rounded-[var(--radius)] text-sm transition-colors btn-ink ink-bg',
    );
  });

  it('keeps legacy themeSelect size available for non-instrument callers', () => {
    expect(buttonClassName({ size: 'themeSelect', tone: 'default' })).toContain('min-w-24');
    expect(buttonClassName({ size: 'themeSelect', tone: 'default' })).toContain('outline-none');
  });

  it('supports explicit leading and trailing icon button shapes', () => {
    expect(buttonClassName({ size: 'iconText', tone: 'default' })).toBe(
      'inline-flex items-center gap-2 uppercase text-xs font-bold rule px-3 py-2 rounded-[var(--radius)] btn-ink',
    );
    expect(buttonClassName({ size: 'iconText', tone: 'default', iconPosition: 'end' })).toBe(
      'inline-flex flex-row-reverse items-center gap-2 uppercase text-xs font-bold rule px-3 py-2 rounded-[var(--radius)] btn-ink',
    );
  });

  it('supports explicit icon-only button shapes', () => {
    expect(buttonClassName({ size: 'icon', tone: 'default' })).toBe(
      'inline-flex h-8 w-8 items-center justify-center rule rounded-[var(--radius)] p-2 btn-ink',
    );
    expect(buttonClassName({ size: 'roundIcon', tone: 'danger' })).toBe(
      'inline-flex h-8 w-8 items-center justify-center rounded-full p-1 text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]',
    );
  });

  it('keeps caller-specific additions at the end', () => {
    expect(buttonClassName({ size: 'iconText', tone: 'danger', className: 'disabled:opacity-45' })).toBe(
      'inline-flex items-center gap-2 uppercase text-xs font-bold rule px-3 py-2 rounded-[var(--radius)] text-[var(--danger)] disabled:opacity-45',
    );
  });
});
