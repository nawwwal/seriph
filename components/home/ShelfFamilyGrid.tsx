'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import FamilyCover from '@/components/font/FamilyCover';
import { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import type { ShelfSelectionState } from '@/lib/shelf/selectionState';

const LAYOUT_ANIMATION_LIMIT = 60;

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
    <div className={className}>
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

export default function ShelfFamilyGrid(props: ShelfFamilyGridProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const animateCards = !shouldReduceMotion && props.families.length <= LAYOUT_ANIMATION_LIMIT;
  const cardClass = `h-full ${props.isRefreshing ? 'shimmer' : ''}`;
  if (!animateCards) {
    return props.families.map((family) => <FamilyCard key={family.id} {...props} family={family} className={cardClass} />);
  }
  return (
    <AnimatePresence mode="popLayout">
      {props.families.map((family) => (
        <motion.div
          key={family.id}
          layout
          layoutId={`family-${family.id}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cardClass}
        >
          <FamilyCard {...props} family={family} className="h-full" />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
