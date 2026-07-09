import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumePendingFonts, storePendingFonts } from '@/utils/pendingFonts';

afterEach(() => vi.unstubAllGlobals());

describe('pending font handoff', () => {
  it('hands local files directly to the same account', () => {
    const file = new File(['font'], 'same-account.woff2');
    vi.stubGlobal('window', {});

    storePendingFonts([file], 'user-a');

    expect(consumePendingFonts('user-a')).toEqual([file]);
  });

  it('clears rather than handing local files to a different account', () => {
    const file = new File(['font'], 'account-a.woff2');
    vi.stubGlobal('window', {});

    storePendingFonts([file], 'user-a');

    expect(consumePendingFonts('user-b')).toBeUndefined();
    expect(consumePendingFonts('user-a')).toBeUndefined();
  });
});
