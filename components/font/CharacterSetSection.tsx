'use client';

import { useMemo } from 'react';
import type { FontFamily } from '@/models/font.models';
import { buildCharacterSet, groupCharacters, type CharacterGroups } from '@/lib/utils/characterSet';

const GROUP_LABELS: { key: keyof CharacterGroups; label: string }[] = [
  { key: 'uppercase', label: 'Uppercase' },
  { key: 'lowercase', label: 'Lowercase' },
  { key: 'numbers', label: 'Numbers' },
  { key: 'punctuation', label: 'Punctuation' },
  { key: 'symbols', label: 'Symbols' },
  { key: 'other', label: 'Other' },
];

function CharacterGrid({
  characters,
  familyName,
  isFirst,
  label,
}: {
  characters: string[];
  familyName: string;
  isFirst: boolean;
  label: string;
}) {
  return (
    <div
      className={`grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] ${
        isFirst ? '' : '-mt-px border-t border-[var(--ink)]'
      }`}
    >
      <div className="col-span-full border-b border-[var(--ink)] px-4 py-3 font-sans text-xs font-bold not-italic opacity-80 uppercase">
        {label} ({characters.length})
      </div>
      {characters.map((character, index) => (
        <span
          key={`${character}-${index}`}
          className="flex aspect-square items-center justify-center border-b border-r border-[var(--ink)] text-xl not-italic sm:text-2xl"
          style={{ fontFamily: familyName, fontStyle: 'normal' }}
        >
          {character}
        </span>
      ))}
    </div>
  );
}

export default function CharacterSetSection({ family }: { family: FontFamily }) {
  const characterSet = useMemo(() => buildCharacterSet(family), [family]);
  const groups = useMemo(() => groupCharacters(characterSet), [characterSet]);
  const visibleGroups = GROUP_LABELS.filter(({ key }) => groups[key].length > 0);

  return (
    <section className="mt-10">
      <h2 className="uppercase font-black text-2xl sm:text-3xl rule-b pb-4">Character Set</h2>
      <div className="mt-6 overflow-hidden rounded-[var(--radius)] rule">
        {characterSet.size > 0 ? (
          <div>
            {visibleGroups.map(({ key, label }, index) => (
              <CharacterGrid
                key={key}
                characters={groups[key]}
                familyName={family.name}
                isFirst={index === 0}
                label={label}
              />
            ))}
            <div className="-mt-px border-t border-[var(--ink)] px-4 py-3 font-sans text-sm not-italic opacity-70">
              Total: {characterSet.size} characters
            </div>
          </div>
        ) : (
          <div className="p-6 text-base opacity-70">
            Character set information not available for this font.
          </div>
        )}
      </div>
    </section>
  );
}
