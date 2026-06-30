'use client';

import { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import Link from 'next/link';
import { memo, useMemo } from 'react';
import { Check } from 'lucide-react';
import { useRegisterFamilyFonts } from '@/lib/hooks/useRegisterFamilyFonts';
import { useFamilyRoutePrefetch } from '@/lib/hooks/useFamilyRoutePrefetch';
import { useInViewport } from '@/lib/hooks/useInViewport';
import { GeneratedCoverArt, getSampleChars, isFullFamily, toShelfFamily, useRegisterShelfFace } from './FamilyCoverArt';
import { deriveCoverDna } from '@/lib/covers/coverDna';

const PREVIEW_FONT_ROOT_MARGIN = '1800px';

interface FamilyCoverProps {
  family: FontFamily | ShelfFamily;
  mode: 'spines' | 'covers';
  coverSeed?: number;
  description?: string;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelected?: (familyId: string) => void;
  onOpenContextMenu?: (event: { familyId: string; x: number; y: number }) => void;
}

function FamilyCover({
  family,
  mode,
  coverSeed = 0,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelected,
  onOpenContextMenu,
  description,
}: FamilyCoverProps) {
  const { ref, inView } = useInViewport<HTMLAnchorElement>(PREVIEW_FONT_ROOT_MARGIN);
  useRegisterFamilyFonts(isFullFamily(family) ? family : null, { enabled: inView, representativeOnly: true });
  useRegisterShelfFace(family, inView);
  const sampleChars = getSampleChars(family.classification);
  const isVariable = isFullFamily(family) ? family.fonts?.some((f) => f.isVariable) : family.isVariable;
  const styleCount = isFullFamily(family) ? family.fonts.length : family.styleCount;
  const shelfFamily = useMemo(() => toShelfFamily(family), [family]);
  const prefetchFamily = useFamilyRoutePrefetch(family.id, !isSelectionMode, shelfFamily);
  const dna = useMemo(() => deriveCoverDna(shelfFamily, coverSeed), [coverSeed, shelfFamily]);

  return (
    <Link
      ref={ref}
      href={`/family/${family.id}`}
      onPointerEnter={prefetchFamily} onPointerDown={prefetchFamily} onFocus={prefetchFamily} onTouchStart={prefetchFamily}
      onClick={(event) => {
        if (!isSelectionMode) {
          prefetchFamily();
          return;
        }
        event.preventDefault();
        onToggleSelected?.(family.id);
      }}
      onContextMenu={(event) => {
        if (!onOpenContextMenu) return;
        event.preventDefault();
        onOpenContextMenu({ familyId: family.id, x: event.clientX, y: event.clientY });
      }}
      className={`relative h-full rule rounded-[var(--radius)] overflow-hidden flex flex-col cursor-pointer seriph-card-hover ${isSelected ? 'ring-2 ring-[var(--ink)]' : ''}`}
      aria-pressed={isSelectionMode ? isSelected : undefined}
    >
      {isSelectionMode && <div className={`absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rule rounded-[var(--radius)] bg-[var(--paper)] ${isSelected ? 'ink-bg' : ''}`}>{isSelected && <Check size={17} aria-hidden="true" />}</div>}
      <div className="relative flex-1 flex items-end p-4 sm:p-5 md:p-6 bg-[color-mix(in_srgb,var(--ink)_6%,var(--paper))]">
        <GeneratedCoverArt family={family} coverSeed={coverSeed} />
        <div className="w-full relative z-10" style={{ transform: `translate(${dna.specimenX - 16}%, ${dna.specimenY - 46}%) scale(${dna.specimenScale})`, transformOrigin: 'left bottom' }}>
          <div
            className="text-6xl sm:text-7xl lg:text-6xl xl:text-7xl leading-none font-black uppercase tracking-normal family-sample truncate-2"
            style={{
              fontFamily: family.name,
              letterSpacing: '0',
            }}
          >
            {sampleChars}
          </div>
        </div>
      </div>
      <div className="rule-t p-3 sm:p-4 bg-[var(--paper)]">
        <div className="text-xl font-extrabold truncate family-name" style={{ fontFamily: family.name }}>{family.name}</div>
        {description && (
          <p className="mt-2 text-xs normal-case font-normal leading-snug opacity-70 line-clamp-2">{description}</p>
        )}
        <div className="mt-3 flex justify-between items-center text-xs uppercase">
          <div>
            <span className="font-bold">Styles:</span> <span>{styleCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isVariable && (
              <span className="font-bold text-[10px] rule px-1.5 py-0.5 rounded-[var(--radius)]">
                Var
              </span>
            )}
            <span className="font-bold">{family.classification}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default memo(FamilyCover);
