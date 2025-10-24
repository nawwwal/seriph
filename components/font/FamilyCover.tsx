'use client';

import { FontFamily } from '@/models/font.models';
import Link from 'next/link';

interface FamilyCoverProps {
  family: FontFamily;
  mode: 'spines' | 'covers';
}

// Generate a deterministic pattern based on family name
function getFamilyPattern(familyName: string): string {
  const hash = familyName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const patterns = [
    'linear-gradient(180deg, var(--ink) 0%, transparent 10%, transparent 90%, var(--ink) 100%)',
    'repeating-linear-gradient(45deg, color-mix(in srgb, var(--ink) 15%, transparent) 0, color-mix(in srgb, var(--ink) 15%, transparent) 6px, transparent 6px, transparent 14px)',
    'linear-gradient(90deg, color-mix(in srgb, var(--ink) 10%, transparent) 0 50%, transparent 50% 100%), linear-gradient(color-mix(in srgb, var(--ink) 10%, transparent), color-mix(in srgb, var(--ink) 10%, transparent))',
    'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--ink) 15%, transparent) 0%, transparent 70%)',
  ];
  return patterns[hash % patterns.length];
}

// Get sample characters based on classification
function getSampleChars(classification: string): string {
  const samples: Record<string, string> = {
    Sans: 'Aa',
    Serif: 'Rg',
    Mono: '{ }',
    Display: 'Qq',
    Script: 'Sz',
  };
  return samples[classification] || 'Aa';
}

export default function FamilyCover({ family, mode }: FamilyCoverProps) {
  const pattern = getFamilyPattern(family.name);
  const sampleChars = getSampleChars(family.classification);

  return (
    <Link
      href={`/family/${family.id}`}
      className="relative rule rounded-[var(--radius)] overflow-hidden flex flex-col cursor-pointer transition-transform hover:scale-[1.02]"
      style={{ background: pattern }}
    >
      <div className="relative flex-1 flex items-end p-4 sm:p-5 md:p-6">
        <div className="cover-stripe absolute inset-0"></div>
        <div className="w-full relative z-10">
          <div
            className="text-[11vw] sm:text-[7vw] lg:text-[4vw] xl:text-[3.2vw] 2xl:text-[2.8vw] leading-none font-black uppercase tracking-tight family-sample truncate-2"
            style={{
              fontFamily: family.name,
              letterSpacing: '-0.015em',
            }}
          >
            {sampleChars}
          </div>
        </div>
      </div>
      <div className="rule-t p-3 sm:p-4 bg-[var(--paper)]">
        <div className="uppercase text-xs font-bold opacity-80">Family</div>
        <div className="text-xl font-extrabold truncate family-name">{family.name}</div>
        <div className="mt-1 flex justify-between text-xs uppercase">
          <div>
            <span className="font-bold">Styles:</span> <span>{family.fonts.length}</span>
          </div>
          <div className="font-bold">{family.classification}</div>
        </div>
      </div>
    </Link>
  );
}

