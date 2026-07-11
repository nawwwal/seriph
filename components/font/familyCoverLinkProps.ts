import type { MouseEvent, TouchEvent } from 'react';

/** Shared click / context / prefetch wiring for family cover links. */
export function familyCoverLinkHandlers(opts: {
  isSelectionMode: boolean;
  familyId: string;
  prefetchFamily: () => void;
  onToggleSelected?: (familyId: string) => void;
  onOpenContextMenu?: (event: { familyId: string; x: number; y: number }) => void;
}) {
  const { isSelectionMode, familyId, prefetchFamily, onToggleSelected, onOpenContextMenu } = opts;
  return {
    onPointerEnter: prefetchFamily,
    onPointerDown: prefetchFamily,
    onFocus: prefetchFamily,
    onTouchStart: prefetchFamily as unknown as (e: TouchEvent) => void,
    onClick: (event: MouseEvent) => {
      if (!isSelectionMode) {
        prefetchFamily();
        return;
      }
      event.preventDefault();
      onToggleSelected?.(familyId);
    },
    onContextMenu: (event: MouseEvent) => {
      if (!onOpenContextMenu) return;
      event.preventDefault();
      onOpenContextMenu({ familyId, x: event.clientX, y: event.clientY });
    },
  };
}
