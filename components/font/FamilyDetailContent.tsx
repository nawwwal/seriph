'use client';

import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { FontFamily } from '@/models/font.models';
import { SkeletonFooter, SkeletonStyles, SkeletonTester } from '@/components/ui/skeletonBody';
import { Button } from '@/components/ui/Button';
import TypePlayground from '@/components/font/TypePlayground';
import UseFontPanel from '@/components/font/UseFontPanel';
import FamilyHeader from '@/components/font/FamilyHeader';
import FamilyDetailSampleMorph from '@/components/font/FamilyDetailSampleMorph';
import FamilyStyles from '@/components/font/FamilyStyles';
import CharacterSetSection from '@/components/font/CharacterSetSection';
import FamilyFooter from '@/components/font/FamilyFooter';
import { useOptionalFamilyDetail } from '@/components/font/FamilyDetailContext';

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

export default function FamilyDetailContent({ family, isPreview, testerRef }: FamilyDetailContentProps) {
  const ctx = useOptionalFamilyDetail();
  const backgroundError = isPreview ? ctx?.state.error : null;

  return (
    <div className="h-full min-h-0 w-full overflow-auto p-5 sm:p-6 md:p-8 lg:p-10">
      <Settle i={0}>
        <FamilyHeader family={family} />
      </Settle>
      {backgroundError && (
        <div role="alert" className="mt-4 rule flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] px-4 py-2.5 text-sm">
          <span>{backgroundError}</span>
          {ctx && <Button type="button" size="sm" onClick={ctx.actions.retryLoad}>Retry</Button>}
        </div>
      )}
      <Settle i={1}>
        {isPreview ? (
          <>
            <FamilyDetailSampleMorph familyName={family.name} classification={family.classification} />
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
