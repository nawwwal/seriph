'use client';

import type { VariableAxis } from '@/models/font.models';
import TypePlaygroundSliders from './typePlaygroundSliders';
import type { FacePlaygroundState } from './typePlaygroundState';

interface TypePlaygroundControlsProps {
  state: FacePlaygroundState;
  axes: VariableAxis[];
  onPatch: (patch: Partial<FacePlaygroundState>) => void;
  onAxisChange: (tag: string, value: number) => void;
}

/** Size / tracking / leading / axis sliders. Reset + Copy live next to style. */
export default function TypePlaygroundControls({
  state,
  axes,
  onPatch,
  onAxisChange,
}: TypePlaygroundControlsProps) {
  return (
    <TypePlaygroundSliders
      state={state}
      axes={axes}
      onPatch={onPatch}
      onAxisChange={onAxisChange}
    />
  );
}
