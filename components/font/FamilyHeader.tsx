'use client';

import Link from 'next/link';
import type { FontFamily } from '@/models/font.models';

interface FamilyHeaderProps {
  family: FontFamily;
}

/** Detail hero title, summary, mood/use-case tags, pairings, and credits. */
export default function FamilyHeader({ family }: FamilyHeaderProps) {
  const meta = family.metadata;
  const pairingFamilies = meta?.enrichment?.pairingFamilies ?? [];
  const hasTags = (meta?.moods?.length ?? 0) > 0 || (meta?.useCases?.length ?? 0) > 0;
  const peopleNames = (meta?.people ?? []).map((p) => p.name).filter(Boolean);

  return (
    <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
      <h1 className="cap-tight [overflow-wrap:anywhere] uppercase font-black tracking-tight text-[clamp(40px,6vw,80px)] leading-[0.9]">
        {family.name}
      </h1>
      {family.description && (
        <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">
          {family.description}
        </p>
      )}
      {hasTags && (
        <div className="mt-4 flex flex-wrap gap-2">
          {meta?.moods?.map((mood, idx) => (
            <span key={`m${idx}`} className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink">
              {mood}
            </span>
          ))}
          {meta?.useCases?.map((useCase, idx) => (
            <span key={`u${idx}`} className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink">
              {useCase}
            </span>
          ))}
        </div>
      )}
      {pairingFamilies.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {pairingFamilies.map((pair) => (
            <Link key={pair.id} href={`/family/${pair.slug}`} className="rule rounded-[var(--radius)] px-2 py-1 font-bold uppercase hover:ink-bg">
              {pair.name}
            </Link>
          ))}
        </div>
      )}
      {peopleNames.length > 0 && (
        <div className="mt-3 text-sm opacity-75">
          {peopleNames.join(' · ')}
        </div>
      )}
    </header>
  );
}
