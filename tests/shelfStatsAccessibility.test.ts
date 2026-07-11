import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ShelfStats from '@/components/home/ShelfStats';

function renderMode(shelfMode: 'spines' | 'covers') {
  return renderToStaticMarkup(createElement(ShelfStats, {
    stats: null,
    pendingCount: 0,
    shelfMode,
    setShelfMode: vi.fn(),
  }));
}

describe('shelf stats accessibility', () => {
  it('exposes a named group with the selected shelf mode', () => {
    const covers = renderMode('covers');
    const spines = renderMode('spines');

    expect(covers).toMatch(/role="group"[^>]*aria-label="Shelf mode"/);
    expect(covers).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Spines/);
    expect(covers).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Covers/);
    expect(spines).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Spines/);
    expect(spines).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Covers/);
  });
});
