'use client';

import { Font as FontVariant } from '@/models/font.models';

interface StyleCardProps {
  subfamilyName: string;
  variants: FontVariant[];
  familyName: string;
}

export default function StyleCard({ subfamilyName, variants, familyName }: StyleCardProps) {
  const primaryVariant = variants[0];
  const weight = primaryVariant.weight || 400;
  const isItalic = subfamilyName.toLowerCase().includes('italic');

  return (
    <div className="style-card rule rounded-[var(--radius)] overflow-hidden">
      <div className="p-4 pb-2">
        <div className="uppercase text-xs font-bold opacity-80">{subfamilyName}</div>
        <div className="text-sm opacity-70">Weight: {weight}</div>
      </div>
      <div className="px-4 pb-4">
        <div
          className="text-5xl leading-tight"
          style={{
            fontFamily: familyName,
            fontWeight: weight,
            fontStyle: isItalic ? 'italic' : 'normal',
          }}
        >
          Aa
        </div>
        <div
          className="mt-2 text-lg"
          style={{
            fontFamily: familyName,
            fontWeight: weight,
            fontStyle: isItalic ? 'italic' : 'normal',
          }}
        >
          ABCDEFGHIJKLM
          <br />
          abcdefghijklm
        </div>
      </div>
    </div>
  );
}

