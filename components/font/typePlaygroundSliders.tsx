'use client';

import type { VariableAxis } from '@/models/font.models';
import AxisSlider from './AxisSlider';
import TypePlaygroundRange from './TypePlaygroundRange';
import TypePlaygroundLineHeight from './typePlaygroundLineHeight';
import TypePlaygroundUnitToggle from './typePlaygroundUnitToggle';
import type { FacePlaygroundState } from './typePlaygroundState';
import { clampFontSize } from './typePlaygroundModel';
import {
  FONT_SIZE_RANGE,
  LETTER_SPACING_RANGES,
  convertLetterSpacing,
  convertLineHeight,
  type LetterSpacingMode,
  type LineHeightMode,
} from './typePlaygroundUnits';

interface SlidersProps {
  state: FacePlaygroundState;
  axes: VariableAxis[];
  onPatch: (patch: Partial<FacePlaygroundState>) => void;
  onAxisChange: (tag: string, value: number) => void;
}

/** Font size, tracking, leading, and variable-axis controls. */
export default function TypePlaygroundSliders({ state, axes, onPatch, onAxisChange }: SlidersProps) {
  const spacingRange = LETTER_SPACING_RANGES[state.letterSpacingMode];
  const setSpacingMode = (mode: LetterSpacingMode) =>
    onPatch({
      letterSpacingMode: mode,
      letterSpacingValue: convertLetterSpacing(
        state.letterSpacingValue, state.letterSpacingMode, mode, state.fontSize,
      ),
    });
  const setLineHeightMode = (mode: LineHeightMode) =>
    onPatch({
      lineHeightMode: mode,
      lineHeightValue: convertLineHeight(
        state.lineHeightValue, state.lineHeightMode, mode, state.fontSize,
      ),
    });

  return (
    <div className="mt-6 grid grid-cols-1 items-end gap-x-6 gap-y-5 md:grid-cols-2">
      <TypePlaygroundRange
        id="playground-font-size" label="Font size" {...FONT_SIZE_RANGE}
        value={state.fontSize} unit="px" ariaValueText={`${state.fontSize} pixels`}
        onChange={(fontSize) => onPatch({ fontSize: clampFontSize(fontSize) })}
      />
      <TypePlaygroundRange
        id="playground-letter-spacing"
        label="Letter spacing"
        {...spacingRange}
        value={state.letterSpacingValue}
        unit={state.letterSpacingMode}
        ariaValueText={`${state.letterSpacingValue}${state.letterSpacingMode} letter spacing`}
        onChange={(letterSpacingValue) => onPatch({ letterSpacingValue })}
        valuePrefix={(
          <TypePlaygroundUnitToggle
            modes={['em', 'px'] as const}
            value={state.letterSpacingMode}
            onChange={setSpacingMode}
            label="Letter spacing unit"
          />
        )}
      />
      <TypePlaygroundLineHeight state={state} setMode={setLineHeightMode} onPatch={onPatch} />
      {axes.map((axis) => (
        <AxisSlider key={axis.tag} axis={axis}
          value={state.axisValues[axis.tag] ?? axis.defaultValue} onChange={onAxisChange} />
      ))}
    </div>
  );
}
