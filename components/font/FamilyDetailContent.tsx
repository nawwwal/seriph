'use client';

import { useMemo, type RefObject } from 'react';
import type { FontFamily } from '@/models/font.models';
import { SkeletonFooter, SkeletonStyles, SkeletonTester } from '@/components/ui/skeletonBody';
import Specimen from '@/components/font/Specimen';
import TypeTester from '@/components/font/TypeTester';
import UseFontPanel from '@/components/font/UseFontPanel';
import VariableFontPlayground from '@/components/font/VariableFontPlayground';
import FamilyHeader from '@/components/font/FamilyHeader';
import FamilyStyles from '@/components/font/FamilyStyles';
import CharacterSetSection from '@/components/font/CharacterSetSection';
import FamilyFooter from '@/components/font/FamilyFooter';
import FamilyInsights from '@/components/font/FamilyInsights';

interface FamilyDetailContentProps {
  family: FontFamily;
  isPreview: boolean;
  testerRef: RefObject<HTMLDivElement | null>;
  onAddStyleFiles: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTestInText: () => void;
}

export default function FamilyDetailContent({
  family,
  isPreview,
  testerRef,
  onAddStyleFiles,
  onTestInText,
}: FamilyDetailContentProps) {
  const variableFont = useMemo(
    () => isPreview ? null : family.fonts?.find((f) => f.isVariable && (f.variableAxes?.length ?? 0) > 0) ?? null,
    [family.fonts, isPreview]
  );

  return (
    <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
      <FamilyHeader family={family} onAddStyleFiles={onAddStyleFiles} onTestInText={onTestInText} />
      <Specimen family={family} />
      <UseFontPanel family={family} />
      <FamilyInsights enrichment={family.metadata?.enrichment} />
      {isPreview ? (
        <>
          <SkeletonStyles />
          <SkeletonTester />
          <SkeletonFooter />
        </>
      ) : (
        <>
          {variableFont && (
            <section className="mt-6">
              <h2 className="uppercase font-black text-2xl sm:text-3xl rule-b pb-4 mb-6">Variable</h2>
              <VariableFontPlayground font={variableFont} fontFamilyName={family.name} />
            </section>
          )}
          <FamilyStyles family={family} />
          <div ref={testerRef}>
            <TypeTester family={family} />
          </div>
          <CharacterSetSection family={family} />
          <FamilyFooter family={family} />
        </>
      )}
    </div>
  );
}
