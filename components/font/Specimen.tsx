'use client';

import { FontFamily } from '@/models/font.models';

interface SpecimenProps {
  family: FontFamily;
}

export default function Specimen({ family }: SpecimenProps) {
  const primaryFont = family.fonts[0];

  return (
    <section className="mt-8 mb-6">
      <div
        className="specimen-container rule p-6 rounded-[var(--radius)] overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--ink) 10%, transparent), transparent 60%)',
        }}
      >
        <div className="cover-stripe absolute inset-0"></div>
        <div
          className="specimen-text text-[clamp(72px,10vw,180px)] leading-[0.9] font-black tracking-tight relative z-10"
          style={{ fontFamily: family.name }}
        >
          AaBbCcDdEeFf
          <br />
          0123456789
        </div>
        <div
          className="specimen-pangram text-2xl sm:text-3xl md:text-4xl font-normal mt-6"
          style={{ fontFamily: family.name }}
        >
          The quick brown fox jumps over the lazy dog.
        </div>
      </div>
    </section>
  );
}

