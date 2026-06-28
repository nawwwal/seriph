'use client';

import { useRef } from 'react';
import type { FontFamily } from '@/models/font.models';

interface FamilyHeaderProps {
  family: FontFamily;
  onAddStyleFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTestInText: () => void;
}

export default function FamilyHeader({ family, onAddStyleFiles, onTestInText }: FamilyHeaderProps) {
  const addStyleInputRef = useRef<HTMLInputElement | null>(null);
  const meta = family.metadata;
  const hasTags = (meta?.moods?.length ?? 0) > 0 || (meta?.useCases?.length ?? 0) > 0;

  return (
    <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(40px,6vw,80px)] leading-[0.9]">
          {family.name}
        </h1>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <input ref={addStyleInputRef} type="file" multiple accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={onAddStyleFiles} />
          <button onClick={() => addStyleInputRef.current?.click()} className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm sm:text-base btn-ink">
            Add Style <span className="caret"></span>
          </button>
          <button onClick={onTestInText} className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm sm:text-base btn-ink">
            Test in Text
          </button>
        </div>
      </div>
      {family.description && <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">{family.description}</p>}
      {hasTags && (
        <div className="mt-4 flex flex-wrap gap-2">
          {meta?.moods?.map((mood, idx) => (
            <span key={`m${idx}`} className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink">{mood}</span>
          ))}
          {meta?.useCases?.map((useCase, idx) => (
            <span key={`u${idx}`} className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink">{useCase}</span>
          ))}
        </div>
      )}
      {meta?.people && meta.people.length > 0 && (
        <div className="mt-3 text-sm opacity-80">
          {meta.people.map((person, idx) => (
            <span key={idx}>
              {person.role === 'designer' ? 'Designed by' : person.role === 'foundry' ? 'Foundry' : 'Contributor'}: {person.name}
              {idx < meta.people!.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}
