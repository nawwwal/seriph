'use client';

import type { FontFamily } from '@/models/font.models';
import AppStatusStrip from '@/components/layout/AppStatusStrip';
import { TIMING } from '@/lib/motion/catalogDetailStoryboard';

/** Bottom status metrics for the open font family. */
export default function FamilyStatusStats({ family }: { family: FontFamily }) {
  const styleCount = family.fonts.length;
  const hasVariable = family.fonts.some((face) => face.isVariable);
  const foundry =
    family.foundry ||
    family.metadata?.foundry ||
    family.metadata?.people?.find((person) => person.role === 'foundry')?.name;
  const classification =
    family.classification || family.metadata?.enrichment?.classification;
  const glyphTotal = family.fonts.reduce(
    (sum, face) => sum + (face.metadata?.glyphCount ?? 0),
    0,
  );
  const mood =
    family.metadata?.moods?.[0] || family.metadata?.enrichment?.moods?.[0];

  const items: Array<[string, string]> = [
    ['Styles', String(styleCount)],
    ['Kind', hasVariable ? 'Variable' : 'Static'],
  ];
  if (classification) items.push(['Class', classification]);
  if (foundry) items.push(['Foundry', foundry]);
  if (glyphTotal > 0) items.push(['Glyphs', String(glyphTotal)]);
  if (mood) items.push(['Mood', mood]);

  return (
    <AppStatusStrip>
      <dl className="flex min-w-max items-center gap-x-4 whitespace-nowrap pr-2">
        {items.map(([label, value], i) => (
          <div
            key={label}
            className="status-metric-enter flex items-baseline gap-1"
            style={{ animationDelay: `${i * TIMING.staggerMs}ms` }}
          >
            <dt className="font-bold opacity-60">{label}</dt>
            <dd className="max-w-40 truncate font-black" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </AppStatusStrip>
  );
}
