'use client';

import { useCallback, useState } from 'react';
import type { User } from 'firebase/auth';
import { hardDeleteFamilies, mergeFamilies, undoFamilyMerge } from '@/lib/api/familyMutations';
import {
  enterSelectionMode,
  exitSelectionMode,
  selectionCanMerge,
  toggleSelectedFamily,
  type ShelfSelectionState,
} from '@/lib/shelf/selectionState';

interface UseShelfMutationsInput {
  user: User | null;
  refreshShelf: () => Promise<void>;
}

export function useShelfMutations({ user, refreshShelf }: UseShelfMutationsInput) {
  const [selectionState, setSelectionState] = useState<ShelfSelectionState>({ mode: 'idle' });
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mergeUndo, setMergeUndo] = useState<{ mergeId: string; undoExpiresAt: string } | null>(null);
  const selectedFamilyIds = selectionState.mode === 'selecting' ? selectionState.selectedFamilyIds : [];

  const enterSelection = useCallback((familyId: string) => {
    setMutationError(null);
    setSelectionState(enterSelectionMode(familyId));
  }, []);

  const toggleSelection = useCallback((familyId: string) => {
    setSelectionState((current) => toggleSelectedFamily(current, familyId));
  }, []);

  const cancelSelection = useCallback(() => {
    setMutationError(null);
    setSelectionState(exitSelectionMode());
  }, []);

  const mergeSelected = useCallback(async () => {
    if (!user || selectionState.mode !== 'selecting' || !selectionCanMerge(selectionState)) return;
    const targetFamilyId = selectionState.selectedFamilyIds.includes(selectionState.anchorFamilyId)
      ? selectionState.anchorFamilyId
      : selectionState.selectedFamilyIds[0]!;
    setIsMutating(true);
    setMutationError(null);
    try {
      const result = await mergeFamilies({ getIdToken: () => user.getIdToken(), familyIds: selectionState.selectedFamilyIds, targetFamilyId });
      setSelectionState(exitSelectionMode());
      setMergeUndo({ mergeId: result.mergeId, undoExpiresAt: result.undoExpiresAt });
      await refreshShelf();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to merge families.');
    } finally {
      setIsMutating(false);
    }
  }, [refreshShelf, selectionState, user]);

  const requestDelete = useCallback((familyIds: string[]) => {
    setDeleteError(null);
    setPendingDeleteIds(familyIds);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!user || !pendingDeleteIds?.length) return;
    setIsMutating(true);
    setDeleteError(null);
    try {
      await hardDeleteFamilies({ getIdToken: () => user.getIdToken(), familyIds: pendingDeleteIds });
      setPendingDeleteIds(null);
      setSelectionState(exitSelectionMode());
      await refreshShelf();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete families.');
    } finally {
      setIsMutating(false);
    }
  }, [pendingDeleteIds, refreshShelf, user]);

  const undoMerge = useCallback(async () => {
    if (!user || !mergeUndo) return;
    setIsMutating(true);
    setMutationError(null);
    try {
      await undoFamilyMerge({ getIdToken: () => user.getIdToken(), mergeId: mergeUndo.mergeId });
      setMergeUndo(null);
      await refreshShelf();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to undo merge.');
    } finally {
      setIsMutating(false);
    }
  }, [mergeUndo, refreshShelf, user]);

  return { selectionState, selectedFamilyIds, pendingDeleteIds, mutationError, deleteError, isMutating, mergeUndo, selectionCanMerge, enterSelection, toggleSelection, cancelSelection, mergeSelected, requestDelete, confirmDelete, undoMerge, setPendingDeleteIds, setMergeUndo };
}
