'use client';

import { Select } from '@base-ui/react/select';
import { ChevronDown } from 'lucide-react';
import type { Font } from '@/models/font.models';
import { faceWeightLabel, sortFacesForPlayground } from './typePlaygroundModel';

interface TypePlaygroundStyleSelectProps {
  fonts: Font[]; value: string; onChange: (faceId: string) => void;
}

export default function TypePlaygroundStyleSelect({ fonts, value, onChange }: TypePlaygroundStyleSelectProps) {
  const ordered = sortFacesForPlayground(fonts);
  const selected = ordered.find((font) => font.id === value) ?? ordered[0];
  const weight = selected ? faceWeightLabel(selected) : null;
  const label = selected ? `${selected.subfamily}${weight ? ` · ${weight}` : ''}` : 'Style';
  return (
    <Select.Root value={value} onValueChange={(next) => next && onChange(next)} modal={false}>
      <Select.Trigger type="button" aria-label="Font style" className="rule bg-transparent px-3 py-2 rounded-[var(--radius)] uppercase text-sm font-bold cursor-pointer theme-focus-ring inline-flex items-center gap-2 min-w-[10rem] justify-between">
        <span className="truncate">{label}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 opacity-70" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner side="bottom" align="start" sideOffset={4} alignItemWithTrigger={false} className="z-40">
          <Select.Popup className="max-h-[min(60vh,22rem)] min-w-[14rem] overflow-y-auto rule rounded-[var(--radius)] bg-[var(--paper)] text-[var(--ink)] theme-shadow-lg">
            <Select.List>
              {ordered.map((font) => (
                <Select.Item key={font.id} value={font.id} label={font.subfamily} className={({ highlighted, selected: active }) => [
                  'flex w-full items-center justify-between gap-4 px-3 py-2 text-left uppercase text-xs font-bold cursor-pointer outline-none',
                  highlighted ? 'bg-[var(--muted)]' : '', active ? 'ink-bg' : '',
                ].filter(Boolean).join(' ')}>
                  <span className="truncate">{font.subfamily}</span>
                  {faceWeightLabel(font) ? <span className="shrink-0 font-mono text-[10px] opacity-70 tabular-nums">{faceWeightLabel(font)}</span> : null}
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
