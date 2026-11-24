'use client';

import { useMemo, useState } from 'react';
import type { FontFamily, Font as FontVariant } from '@/models/font.models';
import StyleCard from './StyleCard';
import { isItalicFace } from './typePlaygroundState';
import { Button } from '@/components/ui/Button';

const FILTERS = ['All', 'Regular', 'Bold', 'Italic'] as const;
type StyleFilter = typeof FILTERS[number];

function matchesStyleFilter(filter: StyleFilter, subfamilyName: string, variants: FontVariant[]): boolean {
  if (filter === 'All') return true;
  if (filter === 'Italic') return variants.some((v) => isItalicFace(v)) || /italic|oblique/i.test(subfamilyName);
  if (filter === 'Bold') return variants.some((v) => (v.weight || 400) >= 600) || /bold|black|heavy|semibold|demibold/i.test(subfamilyName);
  if (filter === 'Regular') return variants.some((v) => (v.weight || 400) === 400 && !isItalicFace(v)) || /regular|book|normal|roman/i.test(subfamilyName);
  return true;
}

export default function FamilyStyles({ family }: { family: FontFamily }) {
  const [activeFilter, setActiveFilter] = useState<StyleFilter>('All');

  const grouped = useMemo(() => {
    return (family.fonts ?? []).reduce((acc, font) => {
      const key = font.subfamily || 'Unknown Subfamily';
      (acc[key] ||= []).push(font);
      return acc;
    }, {} as Record<string, FontVariant[]>);
  }, [family]);

  const filtered = useMemo(() => {
    if (activeFilter === 'All') return grouped;
    return Object.entries(grouped).reduce((acc, [key, variants]) => {
      if (matchesStyleFilter(activeFilter, key, variants)) acc[key] = variants;
      return acc;
    }, {} as Record<string, FontVariant[]>);
  }, [grouped, activeFilter]);

  const entries = Object.entries(filtered);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap gap-3 justify-between items-center rule-b pb-4">
        <h2 className="uppercase font-black text-2xl sm:text-3xl">Styles</h2>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              size="sm"
              tone={activeFilter === filter ? 'active' : 'default'}
            >
              {filter}
            </Button>
          ))}
        </div>
      </div>
      {entries.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {entries.map(([subfamilyName, variants]) => (
            <StyleCard key={subfamilyName} subfamilyName={subfamilyName} variants={variants} familyName={family.name} />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm opacity-70">No styles match {activeFilter}.</p>
      )}
    </section>
  );
}
