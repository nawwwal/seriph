'use client';

import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { FontFamily } from '@/models/font.models';
import { SkeletonFooter, SkeletonStyles, SkeletonTester } from '@/components/ui/skeletonBody';
import TypePlayground from '@/components/font/TypePlayground';
import UseFontPanel from '@/components/font/UseFontPanel';
import FamilyHeader from '@/components/font/FamilyHeader';
import FamilyDetailSampleMorph from '@/components/font/FamilyDetailSampleMorph';
import FamilyStyles from '@/components/font/FamilyStyles';
import CharacterSetSection from '@/components/font/CharacterSetSection';
import FamilyFooter from '@/components/font/FamilyFooter';
import FamilyInsights from '@/components/font/FamilyInsights';

interface FamilyDetailContentProps {
  family: FontFamily;
  isPreview: boolean;
  testerRef: RefObject<HTMLDivElement | null>;
}

function Settle({ i, children }: { i: number; children: ReactNode }) {
  return (
    <div className="detail-settle-item" style={{ '--i': i } as CSSProperties}>
      {children}
    </div>
  );
}

export default function FamilyDetailContent({
  family,
  isPreview,
  testerRef,
}: FamilyDetailContentProps) {
  return (
    <div className="h-full min-h-0 w-full overflow-auto p-5 sm:p-6 md:p-8 lg:p-10">
      <Settle i={0}>
        <FamilyHeader family={family} />
      </Settle>
      <Settle i={1}>
        {isPreview ? (
          <>
            <FamilyDetailSampleMorph
              familyName={family.name}
              classification={family.classification}
            />
            <SkeletonTester />
          </>
        ) : (
          <TypePlayground family={family} testerRef={testerRef} />
        )}
      </Settle>
      <Settle i={2}>
        <UseFontPanel family={family} />
      </Settle>
      <Settle i={3}>
        <FamilyInsights enrichment={family.metadata?.enrichment} />
      </Settle>
      <Settle i={4}>
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
      </Settle>
    </div>
  );
}
