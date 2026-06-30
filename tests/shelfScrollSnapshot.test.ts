import { describe, expect, it } from 'vitest';
import {
  parseShelfScrollSnapshot,
  serializeShelfScrollSnapshot,
  type ShelfScrollSnapshot,
} from '@/lib/shelf/shelfScrollSnapshot';

describe('shelf scroll snapshot', () => {
  it('round-trips anchor-based scroll snapshots', () => {
    const snapshot: ShelfScrollSnapshot = {
      top: 5570.4,
      anchorFamilyId: 'bb-manual-mono-pro-or-smbold',
      anchorOffset: 164.8,
      updatedAt: 1782851621,
    };

    expect(parseShelfScrollSnapshot(serializeShelfScrollSnapshot(snapshot))).toEqual({
      top: 5570,
      anchorFamilyId: 'bb-manual-mono-pro-or-smbold',
      anchorOffset: 165,
      updatedAt: 1782851621,
    });
  });

  it('rejects malformed snapshots', () => {
    expect(parseShelfScrollSnapshot('3400')).toBeNull();
    expect(parseShelfScrollSnapshot('not-json')).toBeNull();
    expect(parseShelfScrollSnapshot(JSON.stringify({ top: 10 }))).toBeNull();
  });
});
