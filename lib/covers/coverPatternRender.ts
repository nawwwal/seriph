import type { CoverDna, CoverPattern } from '@/lib/covers/coverDna';
import { disc, bars, spine, band, block } from '@/lib/covers/coverPatternsSwissA';
import { pinstripe, twinDisc, nest, leading, sweep } from '@/lib/covers/coverPatternsSwissB';

type Renderer = (dna: CoverDna) => string[];

const RENDERERS: Record<CoverPattern, Renderer> = {
  disc,
  bars,
  spine,
  band,
  block,
  pinstripe,
  'twin-disc': twinDisc,
  nest,
  leading,
  sweep,
};

export function renderCoverSvgParts(dna: CoverDna): string[] {
  return (RENDERERS[dna.pattern] ?? disc)(dna);
}
