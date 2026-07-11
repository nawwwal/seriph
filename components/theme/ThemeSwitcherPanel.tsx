'use client';

import { Select } from '@base-ui/react/select';
import type { ThemeName } from '@/lib/theme/themes';
import ThemeRoller from './ThemeRoller';

interface ThemeSwitcherPanelProps {
  committedValue: ThemeName;
  onPreview: (theme: ThemeName) => void;
  onCommit: (theme: ThemeName) => void;
}

/** Popup shell around the infinite theme roller. */
export default function ThemeSwitcherPanel({
  committedValue,
  onPreview,
  onCommit,
}: ThemeSwitcherPanelProps) {
  return (
    <Select.Portal>
      <Select.Positioner
        side="top"
        align="end"
        sideOffset={10}
        alignItemWithTrigger={false}
        className="z-50"
      >
        <Select.Popup className="overflow-hidden rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] theme-shadow-xl">
          <div className="py-3">
            <ThemeRoller
              committed={committedValue}
              onPreview={onPreview}
              onCommit={onCommit}
            />
          </div>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  );
}
