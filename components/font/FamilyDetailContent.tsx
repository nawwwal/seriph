'use client';

import type { RefObject } from 'react';
import type { FontFamily } from '@/models/font.models';
import { SkeletonFooter, SkeletonStyles, SkeletonTester } from '@/components/ui/skeletonBody';
import Specimen from '@/components/font/Specimen';
import TypePlayground from '@/components/font/TypePlayground';
import UseFontPanel from '@/components/font/UseFontPanel';
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
  return (
    <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
      <FamilyHeader family={family} onAddStyleFiles={onAddStyleFiles} onTestInText={onTestInText} />
      <Specimen family={family} />
      {isPreview ? <SkeletonTester /> : <TypePlayground family={family} testerRef={testerRef} />}
      <UseFontPanel family={family} />
      <FamilyInsights enrichment={family.metadata?.enrichment} />
      {isPreview ? (
        <>
          <SkeletonStyles />
          <SkeletonFooter />
        </>
      ) : (
        <>
          <FamilyStyles family={family} />
          <CharacterSetSection family={family} />
          <FamilyFooter family={family} />
        </>
      )}
    </div>
  );
}
