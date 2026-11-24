'use client';

import { useEffect } from 'react';
import { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import { escapeCssString, fontFormatFromUrl, quoteCssFontFamily } from '@/lib/utils/cssFont';

export function getSampleChars(_classification?: string): string {
  return 'ABC';
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
  const cdnUrl = family.coverFace.cdnUrl;
  const key = `${cdnUrl}:${family.coverFace.weight}:${family.coverFace.italic}`;
  const format = fontFormatFromUrl(cdnUrl, 'woff2');
  return {
    key,
    rule: `@font-face { font-family: ${quoteCssFontFamily(family.name)}; src: url('${escapeCssString(cdnUrl)}') format('${escapeCssString(format)}'); font-weight: ${family.coverFace.weight}; font-style: ${family.coverFace.italic ? 'italic' : 'normal'}; font-display: swap; }`,
  };
}

export function useRegisterShelfFace(family: FontFamily | ShelfFamily, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || isFullFamily(family) || !family.coverFace?.cdnUrl) return;
    const id = styleId(family.id);
    const next = shelfFaceRule(family);
    if (!next || shelfFaceRules.get(id)?.key === next.key) return;
    shelfFaceRules.set(id, next);
    const styleEl = ensureShelfStyleElement();
    if (styleEl.sheet) {
      try {
        styleEl.sheet.insertRule(next.rule, styleEl.sheet.cssRules.length);
        return;
      } catch {
        /* Fallback to textContent if stylesheet insertion fails */
      }
    }
    styleEl.appendChild(document.createTextNode(`${next.rule}\n`));
  }, [enabled, family]);
}

/** Cover art slot — left empty for handcrafted patterns later. */
export function GeneratedCoverArt(_props: { family: FontFamily | ShelfFamily; coverSeed: number }) {
  return null;
}
