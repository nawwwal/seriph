'use client';

import { useMemo, type ReactNode } from 'react';
import { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import type { ShelfSelectionState } from '@/lib/shelf/selectionState';
import { groupShelfFamilies, type ShelfFamilyGroup } from '@/lib/shelf/groupShelfFamilies';
import ShelfFamilyGrid from './ShelfFamilyGrid';
import { SHELF_GRID_CLASS } from './shelfGrid';

interface ShelfFamilySectionsProps {
  families: Array<FontFamily | ShelfFamily>;
  shelfMode: 'spines' | 'covers';
  coverSeed: number;
  isRefreshing: boolean;
  selectionState: ShelfSelectionState;
  onToggleSelected?: (familyId: string) => void;
  onOpenContextMenu: (event: { familyId: string; x: number; y: number }) => void;
  tail?: ReactNode;
}

type ShelfFamilyGroupProps = Omit<ShelfFamilySectionsProps, 'families'> & {
  groups: ShelfFamilyGroup[];
};

export function renderShelfFamilyGroups({
  groups,
  shelfMode,
  coverSeed,
  isRefreshing,
  selectionState,
  onToggleSelected,
  onOpenContextMenu,
  tail,
}: ShelfFamilyGroupProps) {
  if (groups.length === 0) {
    return tail ? [(
      <section key="loading" aria-label="Loading families">
        <div className={SHELF_GRID_CLASS}>{tail}</div>
      </section>
    )] : [];
  }

  return groups.map((group, index) => (
    <section key={group.key} aria-label={group.label} className="mb-6 last:mb-0">
      <div className={SHELF_GRID_CLASS}>
        <ShelfFamilyGrid
          families={group.families}
          shelfMode={shelfMode}
          coverSeed={coverSeed}
          isRefreshing={isRefreshing}
          selectionState={selectionState}
          onToggleSelected={onToggleSelected}
          onOpenContextMenu={onOpenContextMenu}
        />
        {index === groups.length - 1 ? tail : null}
      </div>
    </section>
  ));
}

export default function ShelfFamilySections({
  families,
  shelfMode,
  coverSeed,
  isRefreshing,
  selectionState,
  onToggleSelected,
  onOpenContextMenu,
  tail,
}: ShelfFamilySectionsProps) {
  const groupedFamilies = useMemo(() => groupShelfFamilies(families), [families]);
  return renderShelfFamilyGroups({
    groups: groupedFamilies,
    shelfMode,
    coverSeed,
    isRefreshing,
    selectionState,
    onToggleSelected,
    onOpenContextMenu,
    tail,
  });
}
