'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Tracks whether the referenced element is in (or near) the viewport. Used to
 * defer expensive per-card work — like downloading a family's font files — until
 * the card actually scrolls into view, so a shelf of hundreds of families does
 * not load hundreds of fonts at once.
 */
export function useInViewport<T extends Element>(
  rootMargin = '0px'
): { ref: React.RefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null);
  // Without IntersectionObserver (SSR / very old browsers) treat everything as
  // visible so content still loads; otherwise start hidden until observed.
  const [inView, setInView] = useState<boolean>(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}
