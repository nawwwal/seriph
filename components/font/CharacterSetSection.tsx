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

function CharacterGrid({ characters }: { characters: string[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] border-l border-t border-[var(--ink)]">
      {characters.map((character, index) => (
        <span
          key={`${character}-${index}`}
          className="flex aspect-square items-center justify-center border-b border-r border-[var(--ink)] text-xl sm:text-2xl"
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

  return (
    <section className="mt-10">
      <h2 className="uppercase font-black text-2xl sm:text-3xl rule-b pb-4">Character Set</h2>
      <div className="mt-6 rule p-6 rounded-[var(--radius)] overflow-x-auto">
        {characterSet.size > 0 ? (
          <div style={{ fontFamily: family.name }}>
            {GROUP_LABELS.map(({ key, label }) =>
              groups[key].length > 0 ? (
                <div key={key} className="mb-6 last:mb-0">
                  <div className="uppercase text-xs font-bold opacity-80 mb-2">
                    {label} ({groups[key].length})
                  </div>
                  <CharacterGrid characters={groups[key]} />
                </div>
              ) : null
            )}
            <div className="mt-6 pt-4 rule-t text-sm opacity-70">Total: {characterSet.size} characters</div>
          </div>
        ) : (
          <div className="text-base opacity-70">Character set information not available for this font.</div>
        )}
      </div>
    </section>
  );
}
