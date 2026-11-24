'use client';

import type { Font as FontVariant } from '@/models/font.models';
import { quoteCssFontFamily } from '@/lib/utils/cssFont';
import { isItalicFace } from './typePlaygroundState';

interface StyleCardProps {
  subfamilyName: string;
  variants: FontVariant[];
  familyName: string;
}

export default function StyleCard({ subfamilyName, variants, familyName }: StyleCardProps) {
  const primaryVariant = variants[0];
  if (!primaryVariant) return null;
  const weight = primaryVariant.weight || 400;
  const isItalic = isItalicFace(primaryVariant);
  const isVariable = variants.some((v) => v.isVariable);
  const cssFamily = quoteCssFontFamily(familyName);

  return (
    <div className="style-card seriph-card-hover rule rounded-[var(--radius)] overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-4 pb-2">
        <div className="truncate uppercase text-xs font-bold opacity-80">{subfamilyName}</div>
        {isVariable ? (
          <span className="uppercase text-[10px] font-bold rule px-1.5 py-0.5 rounded-[var(--radius)] btn-ink shrink-0">
            Variable
          </span>
        ) : (
          <span className="shrink-0 text-xs font-bold opacity-60">{weight}</span>
        )}
      </div>
      <div className="px-4 pb-4">
        <div className="text-5xl leading-tight" style={{ fontFamily: cssFamily, fontWeight: weight, fontStyle: isItalic ? 'italic' : 'normal' }}>
          Aa
        </div>
        <div className="mt-2 text-lg" style={{ fontFamily: cssFamily, fontWeight: weight, fontStyle: isItalic ? 'italic' : 'normal' }}>
          ABCDEFGHIJKLM
          <br />
          abcdefghijklm
        </div>
      </div>
    </div>
  );
}
