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

const shelfFaceRules = new Map<string, { key: string; rule: string }>();

function ensureShelfStyleElement(): HTMLStyleElement {
  const id = 'seriph-shelf-font-faces';
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  return style;
}

function shelfFaceRule(family: ShelfFamily): { key: string; rule: string } | null {
  if (!family.coverFace?.cdnUrl) return null;
  const key = `${family.coverFace.cdnUrl}:${family.coverFace.weight}:${family.coverFace.italic}`;
  return {
    key,
    rule: `
      @font-face {
        font-family: '${family.name.replace(/'/g, "\\'")}';
        src: url('${family.coverFace.cdnUrl}') format('woff2');
        font-weight: ${family.coverFace.weight};
        font-style: ${family.coverFace.italic ? 'italic' : 'normal'};
        font-display: swap;
      }
    `,
  };
}

export function useRegisterShelfFace(family: FontFamily | ShelfFamily, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || isFullFamily(family) || !family.coverFace?.cdnUrl) return;
    const id = styleId(family.id);
    const next = shelfFaceRule(family);
    if (!next || shelfFaceRules.get(id)?.key === next.key) return;
    shelfFaceRules.set(id, next);
    ensureShelfStyleElement().textContent = [...shelfFaceRules.values()].map((entry) => entry.rule).join('\n');
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
