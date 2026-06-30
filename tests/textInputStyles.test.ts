import { describe, expect, it } from 'vitest';
import { textInputClassName } from '@/components/ui/textInputStyles';

describe('textInputClassName', () => {
  it('preserves the nav search input styling', () => {
    expect(textInputClassName({ size: 'navSearch' })).toBe(
      'h-8 w-full rule rounded-[var(--radius)] bg-[var(--paper)] px-3 py-1 text-sm theme-focus-ring'
    );
  });

  it('preserves the full search workspace input styling', () => {
    expect(textInputClassName({ size: 'search' })).toBe(
      'flex-1 rule rounded-[var(--radius)] bg-[var(--paper)] px-4 py-2 text-sm theme-focus-ring'
    );
  });

  it('preserves auth form input styling', () => {
    expect(textInputClassName({ size: 'form' })).toBe(
      'w-full rule rounded-[var(--radius)] bg-[var(--paper)] px-3 py-2 text-base theme-focus-ring'
    );
  });

  it('preserves destructive confirmation input styling and composes extras', () => {
    expect(textInputClassName({ className: 'auto-focus-sentinel', size: 'confirm' })).toBe(
      'mt-4 w-full rule rounded-[var(--radius)] bg-[var(--surface)] px-3 py-2 font-bold theme-focus-ring auto-focus-sentinel'
    );
  });
});
