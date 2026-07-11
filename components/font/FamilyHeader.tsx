'use client';

import { useRef } from 'react';
import type { FontFamily } from '@/models/font.models';
import { Button } from '@/components/ui/Button';

interface FamilyHeaderProps {
  family: FontFamily;
  onAddStyleFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTestInText: () => void;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink">
      {children}
    </span>
  );
}

export default function FamilyHeader({ family, onAddStyleFiles, onTestInText }: FamilyHeaderProps) {
  const addStyleInputRef = useRef<HTMLInputElement | null>(null);
  const meta = family.metadata;
  const moods = meta?.moods?.length ? meta.moods : family.tags ?? [];
  const useCases = meta?.useCases ?? [];
  const pairings = meta?.similarFamilies ?? [];
  const voice = meta?.technicalCharacteristics?.[0];
  const chips = [
    family.classification ? { key: 'class', label: family.classification } : null,
    meta?.subClassification ? { key: 'sub', label: meta.subClassification } : null,
    ...moods.map((mood, idx) => ({ key: `m${idx}`, label: mood })),
    ...useCases.map((useCase, idx) => ({ key: `u${idx}`, label: useCase })),
    ...pairings.map((hint, idx) => ({ key: `p${idx}`, label: hint })),
  ].filter((item): item is { key: string; label: string } => Boolean(item?.label));

  return (
    <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(40px,6vw,80px)] leading-[0.9]">
          {family.name}
        </h1>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <input
            ref={addStyleInputRef}
            type="file"
            multiple
            accept=".ttf,.otf,.woff,.woff2"
            className="hidden"
            onChange={onAddStyleFiles}
          />
          <Button onClick={() => addStyleInputRef.current?.click()}>
            Add Style <span className="caret"></span>
          </Button>
          <Button onClick={onTestInText}>Test in Text</Button>
        </div>
      </div>
      {family.description ? (
        <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">{family.description}</p>
      ) : null}
      {voice ? <p className="mt-2 text-sm opacity-80 italic tracking-tight">{voice}</p> : null}
      {chips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Chip key={chip.key}>{chip.label}</Chip>
          ))}
        </div>
      ) : null}
      {meta?.people && meta.people.length > 0 ? (
        <div className="mt-3 text-sm opacity-80">
          {meta.people.map((person, idx) => (
            <span key={idx}>
              {person.role === 'designer' ? 'Designed by' : person.role === 'foundry' ? 'Foundry' : 'Contributor'}
              : {person.name}
              {idx < meta.people!.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      ) : meta?.foundry ? (
        <div className="mt-3 text-sm opacity-80">Foundry: {meta.foundry}</div>
      ) : null}
    </header>
  );
}
