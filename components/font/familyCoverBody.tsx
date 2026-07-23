'use client';

import { useState } from 'react';
import { useSafeCoverFontNormalization } from './useSafeCoverFontNormalization';
import FittedSpecimenLine from './FittedSpecimenLine';

const UPPERCASE_SAMPLE = 'ABCDEFGHIJKLM';
const LOWERCASE_SAMPLE = 'abcdefghijklm';

/** Single-plane identity and specimen layout for a family cover card. */
export default function FamilyCoverBody({
  name,
  styleCount,
  isVariable,
  classification,
  normalizeFont,
}: {
  name: string;
  styleCount: number;
  isVariable?: boolean;
  classification: string;
  normalizeFont: boolean;
}) {
  const fontSizeAdjust = useSafeCoverFontNormalization(name, normalizeFont);
  const [specimenScale, setSpecimenScale] = useState(1);
  const styleLabel = `${styleCount} ${styleCount === 1 ? 'style' : 'styles'}`;

  return (
    <div className="flex min-h-[260px] flex-1 flex-col bg-[var(--paper)] p-5 sm:p-6">
      <div className="min-w-0 pr-10">
        <h2 className="truncate text-base font-bold leading-tight">{name}</h2>
        <p className="mt-1 truncate text-sm font-normal opacity-60">
          {styleLabel} · {isVariable ? 'Variable' : 'Static'} · {classification}
        </p>
      </div>

      <div
        className="family-sample mt-auto min-w-0 pt-8"
        style={{ fontFamily: name, fontSizeAdjust, letterSpacing: '0' }}
      >
        <FittedSpecimenLine
          allowGrowth
          className="pb-[12px] text-6xl font-normal leading-none sm:text-7xl"
          frameClassName="h-24"
          hiddenFromScreenReaders
          minFill={0.18}
          onScaleChange={setSpecimenScale}
          targetFill={0.3}
        >
          Aa
        </FittedSpecimenLine>
        <FittedSpecimenLine
          className="text-2xl font-normal leading-snug"
          frameClassName="h-10"
          preferredScale={specimenScale}
        >
          {UPPERCASE_SAMPLE}
        </FittedSpecimenLine>
        <FittedSpecimenLine
          className="text-2xl font-normal leading-snug"
          frameClassName="h-10"
          preferredScale={specimenScale}
        >
          {LOWERCASE_SAMPLE}
        </FittedSpecimenLine>
      </div>
    </div>
  );
}
