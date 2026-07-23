'use client';

import { Select } from '@base-ui/react/select';
import { ChevronDown } from 'lucide-react';
import type { Font } from '@/models/font.models';
import { buildPlaygroundFaceOptions, sortFacesForPlayground } from './typePlaygroundModel';

interface TypePlaygroundStyleSelectProps {
  fonts: Font[];
  value: string;
  onChange: (faceId: string) => void;
}

/**
 * Compact face picker: one trigger, scrollable menu.
 * Beats a chip wall when a family has many static faces.
 */
export default function TypePlaygroundStyleSelect({
  fonts,
  value,
  onChange,
}: TypePlaygroundStyleSelectProps) {
  const options = buildPlaygroundFaceOptions(sortFacesForPlayground(fonts));
  const selected = options.find((option) => option.id === value) ?? options[0];
  if (!selected) return null;

  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        if (typeof next === 'string' && next) onChange(next);
      }}
    >
      <Select.Trigger
        type="button"
        aria-label="Font style"
        className="flex min-w-0 max-w-full flex-1 items-center gap-2 rounded-[var(--radius)] rule bg-[var(--paper)] px-3 py-2 text-left outline-none theme-focus-ring sm:max-w-md"
      >
        <Select.Value className="min-w-0 flex-1 truncate text-sm font-extrabold uppercase tracking-tight">
          {selected.label}
        </Select.Value>
        <span className="shrink-0 text-[10px] font-bold uppercase opacity-50">
          {options.length}
        </span>
        <ChevronDown size={16} className="shrink-0 opacity-60" aria-hidden />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          alignItemWithTrigger={false}
          className="z-50"
        >
          <Select.Popup
            className="max-h-[min(20rem,50vh)] min-w-[var(--anchor-width)] max-w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-[var(--radius)] rule bg-[var(--paper)] text-[var(--ink)] theme-shadow-xl outline-none"
          >
            <Select.List className="p-1">
              {options.map((option) => (
                <Select.Item
                  key={option.id}
                  value={option.id}
                  label={option.label}
                  className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sharp)] px-3 py-2 text-sm font-bold uppercase tracking-tight outline-none data-[highlighted]:bg-[var(--ink)] data-[highlighted]:text-[var(--paper)] data-[selected]:font-extrabold"
                >
                  <Select.ItemText className="min-w-0 truncate">
                    {option.label}
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
