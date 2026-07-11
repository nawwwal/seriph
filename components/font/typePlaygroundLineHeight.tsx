'use client';

import TypePlaygroundRange from './TypePlaygroundRange';
import TypePlaygroundUnitToggle from './typePlaygroundUnitToggle';
import type { FacePlaygroundState } from './typePlaygroundState';
import {
  LINE_HEIGHT_RANGES,
  type LineHeightMode,
} from './typePlaygroundUnits';

interface Props {
  state: FacePlaygroundState;
  setMode: (mode: LineHeightMode) => void;
  onPatch: (patch: Partial<FacePlaygroundState>) => void;
}

export default function TypePlaygroundLineHeight({ state, setMode, onPatch }: Props) {
  const mode = state.lineHeightMode === 'px' ? 'px' : '%';
  return (
    <TypePlaygroundRange
      id="playground-line-height"
      label="Line height"
      {...LINE_HEIGHT_RANGES[mode]}
      value={state.lineHeightValue}
      unit={mode}
      ariaValueText={`${state.lineHeightValue}${mode} line height`}
      onChange={(lineHeightValue) => onPatch({ lineHeightValue })}
      valuePrefix={(
        <TypePlaygroundUnitToggle
          modes={['%', 'px'] as const}
          value={mode}
          onChange={setMode}
          label="Line height unit"
        />
      )}
    />
  );
}
