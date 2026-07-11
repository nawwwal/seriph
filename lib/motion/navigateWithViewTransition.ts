'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

type Direction = 'forward' | 'back';

/**
 * Programmatic nav for shell routes. Framer Motion handles chrome via
 * layout + shell continuity; no View Transition types needed.
 */
export function navigateWithViewTransition(
  router: AppRouterInstance,
  href: string,
  opts: { direction?: Direction; scroll?: boolean } = {},
): void {
  void opts.direction;
  router.push(href, { scroll: opts.scroll ?? false });
}
