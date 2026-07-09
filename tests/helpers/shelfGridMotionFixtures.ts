import type { ComponentProps } from 'react';
import type ShelfFamilyGrid from '@/components/home/ShelfFamilyGrid';
import type { ShelfFamily } from '@/models/shelf.models';

export type ShelfGridProps = ComponentProps<typeof ShelfFamilyGrid>;

export function shelfFamily(id: string, updatedAt: string): ShelfFamily {
  return {
    id,
    name: `Family ${id}`,
    normalizedName: `family ${id}`,
    classification: 'Sans Serif',
    styleCount: 1,
    isVariable: false,
    updatedAt,
  };
}

export function gridProps(families: ShelfFamily[]): ShelfGridProps {
  return {
    families,
    shelfMode: 'covers',
    coverSeed: 0,
    isRefreshing: false,
    selectionState: { mode: 'idle' },
    onOpenContextMenu: () => undefined,
  };
}
