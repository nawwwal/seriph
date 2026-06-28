'use client';

import { FontFamily, Font } from '@/models/font.models';
import Link from 'next/link';

interface FontFamilyCardProps {
  family: FontFamily;
}

export default function FontFamilyCard({ family }: FontFamilyCardProps) {
  if (!family) return null;

  // Simple preview text - can be made dynamic later
  const previewText = family.name || 'AaBbCc';
  const numberOfStyles = family.fonts?.length || 0;

  return (
    <Link href={`/family/${family.id}`} className="block group h-full">
      <div className="bg-[var(--surface)] shadow-lg rounded-xl p-6 border border-[var(--muted)] group-hover:shadow-xl group-hover:border-[var(--accent)] transition-all duration-300 h-full flex flex-col overflow-hidden">
        <div className="mb-4">
          <h2 className="text-2xl font-bold opacity-70 truncate group-hover:text-[var(--info)] transition-colors" title={family.name}>
            {family.name}
          </h2>
          {family.metadata?.foundry && (
            <p className="text-sm opacity-70">By {family.metadata.foundry}</p>
          )}
          {family.metadata?.people && family.metadata.people.length > 0 && (
            <p className="text-xs opacity-70 mt-1">
              {family.metadata.people.filter(p => p.role === 'designer').map(p => p.name).join(', ')}
            </p>
          )}
          {((family.metadata?.moods?.length ?? 0) > 0 || (family.metadata?.useCases?.length ?? 0) > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {family.metadata?.moods?.slice(0, 2).map((mood, idx) => (
                <span key={idx} className="text-xs px-2 py-0.5 bg-[var(--muted)] rounded opacity-70">
                  {mood}
                </span>
              ))}
              {family.metadata?.useCases?.slice(0, 1).map((useCase, idx) => (
                <span key={idx} className="text-xs px-2 py-0.5 bg-[color-mix(in_srgb,var(--info)_18%,transparent)] rounded text-[var(--info)]">
                  {useCase}
                </span>
              ))}
            </div>
          )}
        </div>

        <div
          className="text-5xl mb-6 p-4 bg-[var(--muted)] rounded-lg break-words overflow-hidden flex-grow flex items-center justify-center min-h-[120px] group-hover:bg-[color-mix(in_srgb,var(--info)_12%,transparent)] transition-colors text-center leading-tight"
          style={{ fontFamily: `'${family.name}', sans-serif` }} // Still uses system font as placeholder
          title={`Preview of ${family.name}`}
        >
          {previewText.substring(0, 25)}{previewText.length > 25 ? '...' : ''}
        </div>

        <div className="mt-auto space-y-2 text-sm">
            <p className="font-semibold text-[var(--info)] bg-[color-mix(in_srgb,var(--info)_18%,transparent)] px-3 py-1 rounded-full inline-block">
                {numberOfStyles} Style{numberOfStyles !== 1 ? 's' : ''} Available
            </p>
            {numberOfStyles > 0 && family.fonts && (
                <p className="text-xs opacity-70 truncate" title={family.fonts.map(f => f.subfamily).join(', ')}>
                    Featuring: {family.fonts.map(f => f.subfamily).slice(0, 3).join(', ')}
                    {numberOfStyles > 3 ? ' and more...' : ''}
                </p>
            )}
        </div>

      </div>
    </Link>
  );
}
