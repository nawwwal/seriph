'use client';

import { useEffect, useMemo } from 'react';
import { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import { deriveCoverDna, renderCoverSvgParts } from '@/lib/covers/coverDna';

export function getSampleChars(classification: string): string {
  const samples: Record<string, string> = {
    'Sans Serif': 'Aa',
    Serif: 'Rg',
    Monospace: '{ }',
    'Display & Decorative': 'Qq',
    'Script & Handwriting': 'Sz',
  };
  return samples[classification] || 'Aa';
}

export function isFullFamily(family: FontFamily | ShelfFamily): family is FontFamily {
  return 'fonts' in family;
}

export function toShelfFamily(family: FontFamily | ShelfFamily): ShelfFamily {
  if (!isFullFamily(family)) return family;
  return {
    id: family.id,
    name: family.name,
    normalizedName: family.normalizedName,
    classification: family.classification,
    styleCount: family.fonts.length,
    isVariable: family.fonts.some((font) => font.isVariable),
    updatedAt: family.lastModified,
  };
}

function styleId(familyId: string): string {
  return `seriph-shelf-font-${familyId}`;
}

export function useRegisterShelfFace(family: FontFamily | ShelfFamily, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || isFullFamily(family) || !family.coverFace?.cdnUrl) return;
    const id = styleId(family.id);
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @font-face {
        font-family: '${family.name.replace(/'/g, "\\'")}';
        src: url('${family.coverFace.cdnUrl}') format('woff2');
        font-weight: ${family.coverFace.weight};
        font-style: ${family.coverFace.italic ? 'italic' : 'normal'};
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [enabled, family]);
}

export function GeneratedCoverArt({ family, coverSeed }: { family: FontFamily | ShelfFamily; coverSeed: number }) {
  const shelfFamily = useMemo(() => toShelfFamily(family), [family]);
  const dna = useMemo(() => deriveCoverDna(shelfFamily, coverSeed), [coverSeed, shelfFamily]);
  const parts = useMemo(() => renderCoverSvgParts(dna), [dna]);
  return (
    <svg
      className="absolute inset-0 h-full w-full text-[var(--ink)]"
      viewBox="0 0 240 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ opacity: 0.95 }}
      dangerouslySetInnerHTML={{ __html: parts.join('') }}
    />
  );
}
