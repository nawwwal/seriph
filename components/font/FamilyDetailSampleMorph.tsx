'use client';

import { getSampleChars } from '@/components/font/FamilyCoverArt';

/**
 * Preview-only specimen stand-in while full detail loads.
 * (Body enter is Framer MotionBody; sections use .detail-settle-item.)
 */
export default function FamilyDetailSampleMorph({
  familyName,
  classification,
}: {
  familyId?: string;
  familyName: string;
  classification?: string;
}) {
  const sample = getSampleChars(classification);
  return (
    <section className="mt-4">
      <div
        className="specimen-container relative rule overflow-hidden rounded-[var(--radius)] p-6 min-h-[12rem] md:min-h-[16rem]"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--ink) 10%, transparent), transparent 60%)',
        }}
      >
        <div className="cover-stripe pointer-events-none absolute inset-0" />
        <div
          className="relative z-10 text-6xl font-black uppercase leading-none tracking-normal sm:text-7xl"
          style={{ fontFamily: familyName, letterSpacing: '0' }}
          aria-hidden
        >
          {sample}
        </div>
      </div>
    </section>
  );
}
