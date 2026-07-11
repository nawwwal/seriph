'use client';

import { themeMetaList } from '@/lib/theme/themeMeta';
import type { ThemeName } from '@/lib/theme/themes';
import { visibleOffsets } from './themeRollerMath';
import { DRUM, faceStyle } from './themeRollerMotion';
import { useThemeRoller } from './useThemeRoller';
import ThemeRollerFace from './ThemeRollerFace';

interface ThemeRollerProps {
  committed: ThemeName;
  onPreview: (theme: ThemeName) => void;
  onCommit: (theme: ThemeName) => void;
}

/** iOS barrel — continuous centerness blend; progressive weight by distance. */
export default function ThemeRoller({ committed, onPreview, onCommit }: ThemeRollerProps) {
  const {
    position,
    rootRef,
    onKeyDown,
    onPointerDown,
    onPointerMove,
    endDrag,
    jumpToIndex,
  } = useThemeRoller(committed, onPreview);
  const faces = visibleOffsets(themeMetaList.length, position);
  const viewH = DRUM.rowPx * DRUM.viewRows;

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label="Theme"
      tabIndex={0}
      onKeyDown={(event) => onKeyDown(event, onCommit)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
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
          return (
            <ThemeRollerFace
              key={item.value}
              item={item}
              offset={offset}
              onCommit={onCommit}
              onJump={() => jumpToIndex(index)}
            />
          );
        })}
      </div>
    </div>
  );
}
