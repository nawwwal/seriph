'use client';

import type { ReactNode } from 'react';
import type { Font, VariableAxis } from '@/models/font.models';
import { Button } from '@/components/ui/Button';
import AxisSlider from './AxisSlider';
import TypePlaygroundRange from './TypePlaygroundRange';
import TypePlaygroundStyleSelect from './TypePlaygroundStyleSelect';
import type { FacePlaygroundState } from './typePlaygroundState';
import { clampFontSize } from './typePlaygroundModel';
import { FONT_SIZE_RANGE, LETTER_SPACING_RANGES, LINE_HEIGHT_RANGES,
  convertLetterSpacing, convertLineHeight,
  type LetterSpacingMode, type LineHeightMode } from './typePlaygroundUnits';

interface TypePlaygroundControlsProps {
  fonts: Font[]; selectedFace: Font; state: FacePlaygroundState; axes: VariableAxis[];
  copyLabel: string; children: ReactNode;
  onSelectFace: (faceId: string) => void;
  onPatch: (patch: Partial<FacePlaygroundState>) => void;
  onAxisChange: (tag: string, value: number) => void;
  onReset: () => void; onCopy: () => void;
}

const modeClass = (active: boolean) => `px-2 py-1 text-xs font-bold uppercase ${active ? 'ink-bg' : ''}`;

export default function TypePlaygroundControls({
  fonts, selectedFace, state, axes, copyLabel, children,
  onSelectFace, onPatch, onAxisChange, onReset, onCopy,
}: TypePlaygroundControlsProps) {
  const spacingRange = LETTER_SPACING_RANGES[state.letterSpacingMode];
  const setSpacingMode = (mode: LetterSpacingMode) => onPatch({
    letterSpacingMode: mode,
    letterSpacingValue: convertLetterSpacing(
      state.letterSpacingValue, state.letterSpacingMode, mode, state.fontSize
    ),
  });
  const setLineHeightMode = (mode: LineHeightMode) => onPatch({
    lineHeightMode: mode,
    lineHeightValue: convertLineHeight(state.lineHeightValue, state.lineHeightMode, mode, state.fontSize),
  });
  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <TypePlaygroundStyleSelect fonts={fonts} value={selectedFace.id} onChange={onSelectFace} />
        <div className="flex gap-2">
          <Button onClick={onReset} size="sm">Reset</Button>
          <Button onClick={onCopy} size="sm" className="min-w-[6.5rem]" aria-label="Copy CSS">{copyLabel}</Button>
        </div>
      </div>
      {children}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 items-end">
        <TypePlaygroundRange id="playground-font-size" label="Font size"
          {...FONT_SIZE_RANGE} value={state.fontSize} unit="px"
          ariaValueText={`${state.fontSize} pixels`}
          onChange={(fontSize) => onPatch({ fontSize: clampFontSize(fontSize) })} />
        <div>
          <div className="flex justify-end mb-1" role="group" aria-label="Letter spacing unit">
            {(['em', 'px'] satisfies LetterSpacingMode[]).map((mode) => (
              <button type="button" key={mode} className={modeClass(state.letterSpacingMode === mode)}
                aria-pressed={state.letterSpacingMode === mode} onClick={() => setSpacingMode(mode)}>{mode}</button>
            ))}
          </div>
          <TypePlaygroundRange id="playground-letter-spacing" label="Letter spacing"
            {...spacingRange} value={state.letterSpacingValue} unit={state.letterSpacingMode}
            ariaValueText={`${state.letterSpacingValue}${state.letterSpacingMode} letter spacing`}
            onChange={(letterSpacingValue) => onPatch({ letterSpacingValue })} />
        </div>
        <div>
          <div className="flex justify-end mb-1" role="group" aria-label="Line height mode">
            {(['auto', '%', 'px'] satisfies LineHeightMode[]).map((mode) => (
              <button type="button" key={mode} className={modeClass(state.lineHeightMode === mode)}
                aria-pressed={state.lineHeightMode === mode} onClick={() => setLineHeightMode(mode)}>
                {mode === 'auto' ? 'Auto' : mode}
              </button>
            ))}
          </div>
          {state.lineHeightMode === 'auto' ? (
            <div data-line-height-mode="auto" className="h-8 rule-b flex items-center justify-between gap-3" aria-label="Automatic line height">
              <span className="text-xs font-extrabold uppercase opacity-70">Line height</span>
              <span className="font-mono text-xs font-extrabold uppercase">Auto</span>
            </div>
          ) : (
            <TypePlaygroundRange id="playground-line-height" label="Line height"
              {...LINE_HEIGHT_RANGES[state.lineHeightMode]} value={state.lineHeightValue} unit={state.lineHeightMode}
              ariaValueText={`${state.lineHeightValue}${state.lineHeightMode} line height`}
              onChange={(lineHeightValue) => onPatch({ lineHeightValue })} />
          )}
        </div>
        {axes.map((axis) => <AxisSlider key={axis.tag} axis={axis}
          value={state.axisValues[axis.tag] ?? axis.defaultValue} onChange={onAxisChange} />)}
      </div>
    </>
  );
}
