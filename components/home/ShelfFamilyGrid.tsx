'use client';

import { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import FamilyCover from '@/components/font/FamilyCover';
import { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import type { ShelfSelectionState } from '@/lib/shelf/selectionState';

type FamilyMotionTokens = Map<string, string>;

interface ShelfFamilyGridProps {
  families: Array<FontFamily | ShelfFamily>;
  shelfMode: 'spines' | 'covers';
  coverSeed: number;
  isRefreshing: boolean;
  selectionState: ShelfSelectionState;
  onToggleSelected?: (familyId: string) => void;
  onOpenContextMenu: (event: { familyId: string; x: number; y: number }) => void;
}

function FamilyCard({
  family,
  className,
  ...props
}: Omit<ShelfFamilyGridProps, 'families' | 'isRefreshing'> & {
  family: FontFamily | ShelfFamily;
  className: string;
}) {
  const selectionState = props.selectionState;
  const isSelectionMode = selectionState.mode === 'selecting';
  const selectedIds = isSelectionMode ? selectionState.selectedFamilyIds : [];
  return (
    <div className={className} data-shelf-family-id={family.id}>
      <FamilyCover
        family={family}
        mode={props.shelfMode}
        coverSeed={props.coverSeed}
        isSelectionMode={isSelectionMode}
        isSelected={selectedIds.includes(family.id)}
        onToggleSelected={props.onToggleSelected}
        onOpenContextMenu={props.onOpenContextMenu}
      />
    </div>
  );
}

function familyMotionToken(family: FontFamily | ShelfFamily): string {
  const updatedAt = 'updatedAt' in family ? family.updatedAt : family.lastModified;
  return `${family.id}\u0000${updatedAt}`;
}

export default function ShelfFamilyGrid(props: ShelfFamilyGridProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const nextFamilyTokens: FamilyMotionTokens = new Map(
    props.families.map((family) => [family.id, familyMotionToken(family)])
  );
  const [previousFamilies, setPreviousFamilies] = useState(() => props.families);
  const [previousFamilyTokens, setPreviousFamilyTokens] = useState<FamilyMotionTokens>(
    () => nextFamilyTokens
  );
  const [animatedFamilyIds, setAnimatedFamilyIds] = useState<Set<string>>(() => new Set());

  if (previousFamilies !== props.families) {
    const nextAnimatedFamilyIds = shouldReduceMotion
      ? new Set<string>()
      : new Set(
        Array.from(nextFamilyTokens, ([familyId, token]) =>
          previousFamilyTokens.get(familyId) !== token ? familyId : null
        ).filter((familyId): familyId is string => familyId !== null)
      );

    setPreviousFamilies(props.families);
    setPreviousFamilyTokens(nextFamilyTokens);
    setAnimatedFamilyIds(nextAnimatedFamilyIds);
  }

  return props.families.map((family) => (
    <FamilyCard
      key={family.id}
      {...props}
      family={family}
      className={`h-full ${props.isRefreshing ? 'shimmer' : ''} ${animatedFamilyIds.has(family.id) ? 'shelf-card-enter' : ''}`}
    />
  ));
}
