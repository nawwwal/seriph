'use client';

import { useMemo, useState } from 'react';
import type { FontFamily } from '@/models/font.models';
import { Button } from '@/components/ui/Button';
import { quoteCssFontFamily } from '@/lib/utils/cssFont';
import { buildCharacterSet, groupCharacters, type CharacterGroups } from '@/lib/utils/characterSet';

const INITIAL_GLYPH_CAP = 192;
const GROUP_LABELS: { key: keyof CharacterGroups; label: string }[] = [
  { key: 'uppercase', label: 'Uppercase' },
  { key: 'lowercase', label: 'Lowercase' },
  { key: 'numbers', label: 'Numbers' },
  { key: 'punctuation', label: 'Punctuation' },
  { key: 'spacing', label: 'Spacing' },
  { key: 'symbols', label: 'Symbols' },
  { key: 'other', label: 'Other' },
];
const SPACING_LABELS = new Map<number, string>([
  [0x09, 'Tab'], [0x20, 'Space'], [0xa0, 'NBSP'], [0x2002, 'En space'], [0x2003, 'Em space'], [0x2009, 'Thin'], [0x200a, 'Hair'],
]);

function CharacterGrid({ characters, familyName, isFirst, label }: { characters: string[]; familyName: string; isFirst: boolean; label: string }) {
  const [showAll, setShowAll] = useState(false);
  const cssFamily = quoteCssFontFamily(familyName);
  const visible = showAll || characters.length <= INITIAL_GLYPH_CAP ? characters : characters.slice(0, INITIAL_GLYPH_CAP);
  const hiddenCount = characters.length - visible.length;

  return (
    <div className={`grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] ${isFirst ? '' : '-mt-px border-t border-[var(--ink)]'}`}>
      <div className="col-span-full flex items-center justify-between gap-2 border-b border-[var(--ink)] px-4 py-3 font-sans text-xs font-bold not-italic opacity-80 uppercase">
        <span>{label} ({characters.length})</span>
        {hiddenCount > 0 && (
          <Button type="button" size="sm" onClick={() => setShowAll(true)}>
            Show all {characters.length}
          </Button>
        )}
      </div>
      {visible.map((character, index) => {
        const spacingLabel = SPACING_LABELS.get(character.codePointAt(0) ?? -1);
        return (
          <span
            key={`${character}-${index}`}
            aria-label={spacingLabel}
            className={`flex aspect-square items-center justify-center border-b border-r border-[var(--ink)] not-italic ${
              spacingLabel ? 'font-sans text-[0.625rem] font-bold uppercase' : 'text-xl sm:text-2xl'
            }`}
            style={spacingLabel ? undefined : { fontFamily: cssFamily, fontStyle: 'normal' }}
          >
            {spacingLabel ?? character}
          </span>
        );
      })}
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
              <CharacterGrid key={key} characters={groups[key]} familyName={family.name} isFirst={index === 0} label={label} />
            ))}
          </div>
        ) : (
          <div className="p-6 text-base opacity-70">Character set information not available for this font.</div>
        )}
      </div>
    </section>
  );
}
