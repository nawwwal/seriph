export type ShelfSelectionState =
  | { mode: 'idle' }
  | { mode: 'selecting'; anchorFamilyId: string; selectedFamilyIds: string[] };

type SelectingShelfState = Extract<ShelfSelectionState, { mode: 'selecting' }>;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function enterSelectionMode(familyId: string): SelectingShelfState {
  return { mode: 'selecting', anchorFamilyId: familyId, selectedFamilyIds: [familyId] };
}

export function exitSelectionMode(): ShelfSelectionState {
  return { mode: 'idle' };
}

export function toggleSelectedFamily(state: ShelfSelectionState, familyId: string): SelectingShelfState {
  if (state.mode === 'idle') return enterSelectionMode(familyId);
  const selected = state.selectedFamilyIds.includes(familyId)
    ? state.selectedFamilyIds.filter((id) => id !== familyId)
    : unique([...state.selectedFamilyIds, familyId]);
  return { ...state, selectedFamilyIds: selected };
}

export function selectionCanMerge(state: ShelfSelectionState): boolean {
  return state.mode === 'selecting' && state.selectedFamilyIds.length >= 2;
}
