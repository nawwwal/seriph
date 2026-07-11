'use client';

import { Select } from '@base-ui/react/select';
import { ChevronDown } from 'lucide-react';
import type { Font } from '@/models/font.models';
import { buildPlaygroundFaceOptions, sortFacesForPlayground } from './typePlaygroundModel';

interface TypePlaygroundStyleSelectProps {
  fonts: Font[]; value: string; onChange: (faceId: string) => void;
}

export default function TypePlaygroundStyleSelect({ fonts, value, onChange }: TypePlaygroundStyleSelectProps) {
  const ordered = sortFacesForPlayground(fonts);
  const options = buildPlaygroundFaceOptions(ordered);
  const selected = options.find((option) => option.id === value) ?? options[0];
  const label = selected?.label ?? 'Style';
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
              {options.map((option) => (
                <Select.Item key={option.id} value={option.id} label={option.label} className={({ highlighted, selected: active }) => [
                  'flex w-full items-center justify-between gap-4 px-3 py-2 text-left uppercase text-xs font-bold cursor-pointer outline-none',
                  highlighted ? 'bg-[var(--muted)]' : '', active ? 'ink-bg' : '',
                ].filter(Boolean).join(' ')}>
                  <span className="truncate">{option.label}</span>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
