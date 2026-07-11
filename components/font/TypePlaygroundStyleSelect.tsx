'use client';

import { Select } from '@base-ui/react/select';
import { ChevronDown } from 'lucide-react';
import type { Font } from '@/models/font.models';
import { faceWeightLabel, sortFacesForPlayground } from './typePlaygroundModel';

interface TypePlaygroundStyleSelectProps {
  fonts: Font[];
  value: string;
  onChange: (style: string) => void;
  showWeights?: boolean;
}

export default function TypePlaygroundStyleSelect({
  fonts,
  value,
  onChange,
  showWeights = true,
}: TypePlaygroundStyleSelectProps) {
  const ordered = sortFacesForPlayground(fonts);
  const selected = ordered.find((f) => f.subfamily === value) || ordered[0];
  const selectedWeight = selected && showWeights ? faceWeightLabel(selected) : null;
  const triggerLabel = selected
    ? selectedWeight
      ? `${selected.subfamily} · ${selectedWeight}`
      : selected.subfamily
    : 'Style';

  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      modal={false}
    >
      <Select.Trigger
        type="button"
        aria-label="Font style"
        className="rule bg-transparent px-3 py-2 rounded-[var(--radius)] uppercase text-sm font-bold cursor-pointer theme-focus-ring inline-flex items-center gap-2 min-w-[10rem] justify-between"
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 opacity-70" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner side="bottom" align="start" sideOffset={4} alignItemWithTrigger={false} className="z-40">
          <Select.Popup className="max-h-[min(60vh,22rem)] min-w-[14rem] overflow-y-auto rule rounded-[var(--radius)] bg-[var(--paper)] text-[var(--ink)] theme-shadow-lg">
            <Select.List>
              {ordered.map((font) => {
                const weight = showWeights ? faceWeightLabel(font) : null;
                return (
                  <Select.Item
                    key={font.id}
                    value={font.subfamily}
                    label={font.subfamily}
                    className={({ highlighted, selected }) =>
                      [
                        'flex w-full items-center justify-between gap-4 px-3 py-2 text-left uppercase text-xs font-bold cursor-pointer outline-none',
                        highlighted ? 'bg-[var(--muted)]' : '',
                        selected ? 'ink-bg' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    }
                  >
                    <span className="truncate">{font.subfamily}</span>
                    {weight && (
                      <span className="shrink-0 font-mono text-[10px] opacity-70 tabular-nums">{weight}</span>
                    )}
                  </Select.Item>
                );
              })}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
