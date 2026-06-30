'use client';

import { useMemo } from 'react';
import { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import type { ShelfSelectionState } from '@/lib/shelf/selectionState';
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
}

function groupLabelForFamily(family: FontFamily | ShelfFamily): string {
  const first = family.name.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

export default function ShelfFamilySections({
  families,
  shelfMode,
  coverSeed,
  isRefreshing,
  selectionState,
  onToggleSelected,
  onOpenContextMenu,
}: ShelfFamilySectionsProps) {
  const groupedFamilies = useMemo(() => {
    const groups: Array<{ label: string; families: Array<FontFamily | ShelfFamily> }> = [];
    for (const family of families) {
      const label = groupLabelForFamily(family);
      const current = groups[groups.length - 1];
      if (current?.label === label) current.families.push(family);
      else groups.push({ label, families: [family] });
    }
    return groups;
  }, [families]);

  return groupedFamilies.map((group) => (
    <section key={group.label} aria-labelledby={`shelf-group-${group.label}`}>
      <div className="mb-3 flex items-center gap-3">
        <h2 id={`shelf-group-${group.label}`} className="text-sm sm:text-base uppercase font-black leading-none">
          {group.label}
        </h2>
        <div className="h-px flex-1 bg-[var(--ink)] opacity-20" aria-hidden="true" />
      </div>
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
      </div>
    </section>
  ));
}
