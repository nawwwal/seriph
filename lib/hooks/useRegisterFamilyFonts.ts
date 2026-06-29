'use client';

import { useEffect, useMemo } from 'react';
import type { FontFamily, Font as FontVariant } from '@/models/font.models';

function cssFormatFor(fontFormat: string): string {
  const fmt = (fontFormat || '').toLowerCase();
  if (fmt === 'ttf') return 'truetype';
  if (fmt === 'otf') return 'opentype';
  if (fmt === 'woff2') return 'woff2';
  if (fmt === 'woff') return 'woff';
  return fmt || 'truetype';
}

function buildFontFaceRule(
  familyName: string,
  variant: FontVariant,
  proxiedSrc: string
): string {
  const isItalic = (variant.style || variant.subfamily || '').toLowerCase().includes('italic');
  const weight = variant.weight || 400;
  // Derive the CSS format from the served file extension (woff2 from the CDN),
  // falling back to the original font format.
  const srcExt = (proxiedSrc.split('?')[0].split('.').pop() || '').toLowerCase();
  const format = cssFormatFor(srcExt || String(variant.format || ''));

  // For variable fonts with a weight axis defined, declare a range
  // This assumes downloadUrl points to the variable font file
  const weightRange = (() => {
    if (!variant.isVariable || !variant.variableAxes || variant.variableAxes.length === 0) return String(weight);
    const wght = variant.variableAxes.find(a => a.tag === 'wght');
    if (!wght) return String(weight);
    const min = Math.floor(wght.minValue);
    const max = Math.ceil(wght.maxValue);
    if (min >= max) return String(weight);
    return `${min} ${max}`;
  })();

  return `@font-face {
    font-family: '${familyName}';
    src: url('${proxiedSrc}') format('${format}');
    font-weight: ${weightRange};
    font-style: ${isItalic ? 'italic' : 'normal'};
    font-display: swap;
  }`;
}

/**
 * Injects `@font-face` rules for a family's faces into the document head.
 *
 * `enabled` lets callers defer the work until a card is actually on screen, so a
 * shelf of hundreds of families doesn't download every font at once. The rules
 * are removed when disabled or unmounted, keeping the head and the set of active
 * font downloads bounded as the user scrolls or navigates (the browser HTTP
 * cache makes re-registration cheap on the way back).
 *
 * `representativeOnly` registers a single face (a variable face if present, else
 * the boldest static one) — enough for a cover's display sample, so a shelf card
 * pulls one font file instead of the whole family.
 */
function pickRepresentativeFace(fonts: FontVariant[]): FontVariant[] {
  if (fonts.length <= 1) return fonts;
  const variable = fonts.find((f) => f.isVariable);
  if (variable) return [variable];
  const boldest = fonts.reduce((a, b) => ((b.weight || 0) > (a.weight || 0) ? b : a));
  return [boldest];
}

export function useRegisterFamilyFonts(
  family: FontFamily | null | undefined,
  options?: { enabled?: boolean; representativeOnly?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const representativeOnly = options?.representativeOnly ?? false;
  const styleId = family ? `seriph-fonts-${family.id}` : null;
  const fontFaceRules = useMemo(() => {
    if (!family || !family.fonts || family.fonts.length === 0) return '';

    // Build rules for each variant, proxying URLs through our API to avoid CORS
    const rules: string[] = [];
    const seen = new Set<string>();
    const faces = representativeOnly ? pickRepresentativeFace(family.fonts) : family.fonts;
    for (const v of faces) {
      // Prefer the stable CDN url (woff2); fall back to the legacy proxy.
      const cdn = (v?.metadata as any)?.cdnUrl as string | undefined;
      const storagePath = v?.metadata?.storagePath || null;
      const src = cdn || (storagePath ? `/api/font/gcs?path=${encodeURIComponent(storagePath)}` : null);
      if (!src) continue;
      const key = `${v.id}::${src}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rules.push(buildFontFaceRule(family.name, v, src));
    }

    return rules.join('\n\n');
  }, [family, representativeOnly]);

  useEffect(() => {
    if (!styleId || !fontFaceRules || !enabled) return;

    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = fontFaceRules;

    // Drop the rules when this card scrolls away / unmounts so the active set of
    // font downloads stays bounded. Re-registering on return is cheap (HTTP cache).
    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, [styleId, fontFaceRules, enabled]);
}
