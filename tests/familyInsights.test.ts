import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import FamilyInsights from '@/components/font/FamilyInsights';

describe('FamilyInsights', () => {
  it('renders every populated user-facing insight without internal IDs', () => {
    const markup = renderToStaticMarkup(createElement(FamilyInsights, {
      enrichment: {
        classification: 'geometric sans',
        summary: 'A precise neo-grotesk.',
        moods: ['clear'],
        voice: 'calm and technical',
        useCases: ['product UI'],
        pairingHints: ['Pair with a literary serif'],
        confidence: 0.91,
        enrichedAt: '2026-07-10T00:00:00.000Z',
      },
    }));

    for (const text of [
      'AI Insights', 'A precise neo-grotesk.', 'calm and technical',
      'clear', 'product UI', 'Pair with a literary serif', 'geometric sans',
      '91%', 'Jul 10, 2026',
    ]) expect(markup).toContain(text);
    expect(markup).not.toContain('modelId');
    expect(markup).not.toContain('promptVersion');
  });

  it('omits empty rows and the whole section when no insight is populated', () => {
    const partial = renderToStaticMarkup(createElement(FamilyInsights, {
      enrichment: { summary: 'A precise neo-grotesk.', moods: [] },
    }));

    expect(partial).toContain('A precise neo-grotesk.');
    for (const label of ['Voice', 'Mood', 'Best for', 'Pairing', 'Confidence']) {
      expect(partial).not.toContain(label);
    }
    expect(renderToStaticMarkup(createElement(FamilyInsights, { enrichment: {} }))).toBe('');
  });

  it('omits the mood and use-case grid when both lists are empty', () => {
    const markup = renderToStaticMarkup(createElement(FamilyInsights, {
      enrichment: { summary: 'A precise neo-grotesk.', moods: [], useCases: [] },
    }));

    expect(markup).not.toContain('mt-5 grid gap-5 sm:grid-cols-2');
  });

  it('omits pairing markup without rendering zero for empty pairing hints', () => {
    const markup = renderToStaticMarkup(createElement(FamilyInsights, {
      enrichment: { summary: 'A precise neo-grotesk.', pairingHints: [] },
    }));

    expect(markup).not.toContain('Pairing');
    expect(markup).not.toContain('>0<');
  });
});
