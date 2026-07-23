'use client';

import { useEffect, useState } from 'react';

const COVER_FONT_SIZE_ADJUST = 'cap-height 0.7';
const MIN_SAFE_SCALE = 0.8;
const MAX_SAFE_SCALE = 1.25;
const PROBE_TEXT = 'ABC';
const normalizationCache = new Map<string, string | undefined>();

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function measuredAdjustment(name: string): number {
  const host = document.createElement('div');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    visibility: 'hidden',
    whiteSpace: 'nowrap',
  });
  document.body.appendChild(host);

  const natural = document.createElement('span');
  const adjusted = document.createElement('span');
  host.append(natural, adjusted);
  const styleProbe = (probe: HTMLSpanElement, useAdjustment: boolean) => {
    probe.textContent = PROBE_TEXT;
    Object.assign(probe.style, {
      display: 'inline-block',
      fontFamily: name,
      fontSize: '100px',
      fontSizeAdjust: useAdjustment ? COVER_FONT_SIZE_ADJUST : 'none',
      fontWeight: '900',
      lineHeight: '1',
      whiteSpace: 'nowrap',
    });
  };
  styleProbe(natural, false);
  styleProbe(adjusted, true);
  const naturalWidth = natural.getBoundingClientRect().width;
  const adjustedWidth = adjusted.getBoundingClientRect().width;
  host.remove();
  return naturalWidth > 0 ? adjustedWidth / naturalWidth : 1;
}

/** Apply cap-height normalization only when the browser's correction is bounded. */
export function useSafeCoverFontNormalization(
  name: string,
  enabled: boolean,
): string | undefined {
  const [fontSizeAdjust, setFontSizeAdjust] = useState<string | undefined>(
    normalizationCache.get(name),
  );

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    const measure = async () => {
      if (normalizationCache.has(name)) {
        setFontSizeAdjust(normalizationCache.get(name));
        return;
      }
      await nextFrame();
      try {
        await document.fonts.load(`900 100px ${JSON.stringify(name)}`, PROBE_TEXT);
      } catch {}
      if (disposed) return;
      const scale = measuredAdjustment(name);
      const safe = scale >= MIN_SAFE_SCALE && scale <= MAX_SAFE_SCALE;
      const next = safe ? COVER_FONT_SIZE_ADJUST : undefined;
      normalizationCache.set(name, next);
      setFontSizeAdjust(next);
    };

    void measure();
    return () => {
      disposed = true;
    };
  }, [enabled, name]);

  return fontSizeAdjust;
}
