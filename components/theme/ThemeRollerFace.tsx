'use client';

import type { ThemeMeta } from '@/lib/theme/themeMeta';
import type { ThemeName } from '@/lib/theme/themes';
import { DRUM, faceStyle } from './themeRollerMotion';

/** One barrel face in the theme roller. */
export default function ThemeRollerFace({
  item,
  offset,
  onCommit,
  onJump,
}: {
  item: ThemeMeta;
  offset: number;
  onCommit: (theme: ThemeName) => void;
  onJump: () => void;
}) {
  const selected = Math.abs(offset) < 0.5;
  const style = faceStyle(offset);

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={() => {
        if (selected) onCommit(item.value);
        else onJump();
      }}
      className="absolute inset-x-0 flex items-center justify-center truncate px-3 text-center uppercase outline-none"
      style={{
        top: '50%',
        height: DRUM.rowPx,
        marginTop: -DRUM.rowPx / 2,
        lineHeight: 1,
        willChange: 'transform, opacity, color, font-variation-settings',
        opacity: style.opacity,
        transform: style.transform,
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontVariationSettings: style.fontVariationSettings,
        zIndex: style.zIndex,
        transition: 'none',
        fontFamily: 'var(--font-league-spartan), system-ui, -apple-system, sans-serif',
      }}
    >
      <span
        className="block w-full truncate text-center tracking-[-0.03em]"
        style={{ lineHeight: 0.85, paddingTop: '0.12em' }}
      >
        {item.label}
      </span>
    </button>
  );
}
