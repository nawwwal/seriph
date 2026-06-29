import { describe, expect, it } from 'vitest';
import {
  enterSelectionMode,
  exitSelectionMode,
  selectionCanMerge,
  toggleSelectedFamily,
} from '@/lib/shelf/selectionState';

describe('shelf selection state', () => {
  it('enters selection mode anchored on the context-clicked family', () => {
    const state = enterSelectionMode('family-a');

    expect(state).toEqual({
      mode: 'selecting',
      anchorFamilyId: 'family-a',
      selectedFamilyIds: ['family-a'],
    });
    expect(selectionCanMerge(state)).toBe(false);
  });

  it('toggles selected families and enables merge at two selected cards', () => {
    const one = enterSelectionMode('family-a');
    const two = toggleSelectedFamily(one, 'family-b');
    const backToOne = toggleSelectedFamily(two, 'family-a');

    expect(two.selectedFamilyIds).toEqual(['family-a', 'family-b']);
    expect(selectionCanMerge(two)).toBe(true);
    expect(backToOne.selectedFamilyIds).toEqual(['family-b']);
    expect(selectionCanMerge(backToOne)).toBe(false);
  });

  it('exits selection mode to normal shelf navigation', () => {
    expect(exitSelectionMode()).toEqual({ mode: 'idle' });
  });
});
