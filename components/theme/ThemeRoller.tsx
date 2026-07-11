'use client';

import { themeMetaList } from '@/lib/theme/themeMeta';
import type { ThemeName } from '@/lib/theme/themes';
import { visibleOffsets } from './themeRollerMath';
import { DRUM, faceStyle } from './themeRollerMotion';
import { useThemeRoller } from './useThemeRoller';

interface ThemeRollerProps {
  committed: ThemeName;
  onPreview: (theme: ThemeName) => void;
  onCommit: (theme: ThemeName) => void;
}

/** iOS barrel — continuous centerness blend; progressive weight by distance. */
export default function ThemeRoller({ committed, onPreview, onCommit }: ThemeRollerProps) {
  const wheel = useThemeRoller(committed, onPreview);
  const faces = visibleOffsets(themeMetaList.length, wheel.position);
  const viewH = DRUM.rowPx * DRUM.viewRows;

  return (
    <div
      ref={wheel.rootRef}
      role="listbox"
      aria-label="Theme"
      tabIndex={0}
      onKeyDown={(event) => wheel.onKeyDown(event, onCommit)}
      onPointerDown={wheel.onPointerDown}
      onPointerMove={wheel.onPointerMove}
      onPointerUp={wheel.endDrag}
      onPointerCancel={wheel.endDrag}
      className="theme-roller relative touch-none select-none outline-none focus:outline-none"
      style={{
        width: `min(${DRUM.widthRem}rem, calc(100vw - 1.5rem))`,
        height: viewH,
        perspective: `${DRUM.perspectivePx}px`,
        perspectiveOrigin: '50% 50%',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 z-0 bg-[var(--ink)]"
        style={{ top: '50%', height: DRUM.rowPx, transform: 'translateY(-50%)' }}
      />
      <div
        className="absolute inset-0 z-10 overflow-hidden"
        style={{
          maskImage: 'linear-gradient(transparent, #000 10%, #000 90%, transparent)',
          WebkitMaskImage: 'linear-gradient(transparent, #000 10%, #000 90%, transparent)',
          transformStyle: 'preserve-3d',
        }}
      >
        {faces.map(({ index, offset }) => {
          const item = themeMetaList[index];
          if (!item) return null;
          const selected = Math.abs(offset) < 0.5;
          const style = faceStyle(offset);
          return (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected={selected}
              tabIndex={-1}
              onClick={() => {
                if (selected) onCommit(item.value);
                else wheel.jumpToIndex(index);
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
                fontFamily:
                  'var(--font-league-spartan), system-ui, -apple-system, sans-serif',
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
        })}
      </div>
    </div>
  );
}
