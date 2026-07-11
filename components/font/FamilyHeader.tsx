'use client';

import type { FontFamily } from '@/models/font.models';

interface FamilyHeaderProps {
  family: FontFamily;
}

/** Detail hero title (section settle via .detail-settle-item). */
export default function FamilyHeader({ family }: FamilyHeaderProps) {
  const meta = family.metadata;
  const hasTags = (meta?.moods?.length ?? 0) > 0 || (meta?.useCases?.length ?? 0) > 0;

  return (
    <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
      <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(40px,6vw,80px)] leading-[0.9]">
        {family.name}
      </h1>
      {family.description && (
        <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">
          {family.description}
        </p>
      )}
      {hasTags && (
        <div className="mt-4 flex flex-wrap gap-2">
          {meta?.moods?.map((mood, idx) => (
            <span
              key={`m${idx}`}
              className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink"
            >
              {mood}
            </span>
          ))}
          {meta?.useCases?.map((useCase, idx) => (
            <span
              key={`u${idx}`}
              className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink"
            >
              {useCase}
            </span>
          ))}
        </div>
      )}
      {meta?.people && meta.people.length > 0 && (
        <div className="mt-3 text-sm opacity-80">
          {meta.people.map((person, idx) => (
            <span key={idx}>
              {person.role === 'designer'
                ? 'Designed by'
                : person.role === 'foundry'
                  ? 'Foundry'
                  : 'Contributor'}
              : {person.name}
              {idx < meta.people!.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}
