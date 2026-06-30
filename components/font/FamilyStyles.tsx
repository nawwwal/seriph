'use client';

import { useMemo, useState } from 'react';
import type { FontFamily, Font as FontVariant } from '@/models/font.models';
import StyleCard from './StyleCard';
import { Button } from '@/components/ui/Button';

const FILTERS = ['All', 'Regular', 'Bold', 'Italic'] as const;

export default function FamilyStyles({ family }: { family: FontFamily }) {
  const [activeFilter, setActiveFilter] = useState<string>('All');

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
      if (key.toLowerCase().includes(activeFilter.toLowerCase())) acc[key] = variants;
      return acc;
    }, {} as Record<string, FontVariant[]>);
  }, [grouped, activeFilter]);

  return (
    <section className="mt-6">
      <div className="flex justify-between items-center rule-b pb-4">
        <h2 className="uppercase font-black text-2xl sm:text-3xl">Styles</h2>
        <div className="flex gap-2">
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
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(filtered).map(([subfamilyName, variants]) => (
          <StyleCard key={subfamilyName} subfamilyName={subfamilyName} variants={variants} familyName={family.name} />
        ))}
      </div>
    </section>
  );
}
