'use client';

import { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import Link from 'next/link';
import { memo, useMemo } from 'react';
import { Check } from 'lucide-react';
import { useRegisterFamilyFonts } from '@/lib/hooks/useRegisterFamilyFonts';
import { useFamilyRoutePrefetch } from '@/lib/hooks/useFamilyRoutePrefetch';
import { useInViewport } from '@/lib/hooks/useInViewport';
import { familyCoverLinkHandlers } from './familyCoverLinkProps';
import FamilyCoverBody from './familyCoverBody';
import { isFullFamily, toShelfFamily, useRegisterShelfFace } from './FamilyCoverArt';

const PREVIEW_FONT_ROOT_MARGIN = '1800px';

interface FamilyCoverProps {
  family: FontFamily | ShelfFamily;
  mode: 'spines' | 'covers';
  coverSeed?: number;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelected?: (familyId: string) => void;
  onOpenContextMenu?: (event: { familyId: string; x: number; y: number }) => void;
}

function FamilyCover({
  family, isSelectionMode = false, isSelected = false,
  onToggleSelected, onOpenContextMenu,
}: FamilyCoverProps) {
  const { ref, inView } = useInViewport<HTMLAnchorElement>(PREVIEW_FONT_ROOT_MARGIN);
  useRegisterFamilyFonts(isFullFamily(family) ? family : null, {
    enabled: inView, representativeOnly: true,
  });
  useRegisterShelfFace(family, inView);
  const isVariable = isFullFamily(family)
    ? family.fonts?.some((f) => f.isVariable) : family.isVariable;
  const styleCount = isFullFamily(family) ? family.fonts.length : family.styleCount;
  const shelfFamily = useMemo(() => toShelfFamily(family), [family]);
  const prefetchFamily = useFamilyRoutePrefetch(family.id, !isSelectionMode, shelfFamily);
  const href = `/family/${family.id}`;
  const linkHandlers = familyCoverLinkHandlers({
    isSelectionMode,
    familyId: family.id,
    prefetchFamily,
    onToggleSelected,
    onOpenContextMenu,
  });

  return (
    <Link
      ref={ref}
      href={href}
      scroll={false}
      className={`relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[var(--radius)] rule seriph-card-hover ${isSelected ? 'ring-2 ring-[var(--ink)]' : ''}`}
      aria-pressed={isSelectionMode ? isSelected : undefined}
      {...linkHandlers}
    >
      {isSelectionMode ? (
        <div className={`absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-[var(--radius)] rule bg-[var(--paper)] ${isSelected ? 'ink-bg' : ''}`}>
          {isSelected ? <Check size={17} aria-hidden="true" /> : null}
        </div>
      ) : null}
      <FamilyCoverBody
        name={family.name}
        styleCount={styleCount}
        isVariable={isVariable}
        classification={family.classification}
        normalizeFont={inView}
      />
    </Link>
  );
}

export default memo(FamilyCover);
