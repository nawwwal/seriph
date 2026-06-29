'use client';

import { Font } from '@/models/font.models';
import React, { useMemo } from 'react';
import { useVariableFontFace } from '@/lib/hooks/useVariableFontFace';
import VariableFontPlaygroundControls from './VariableFontPlaygroundControls';

interface VariableFontPlaygroundProps {
  font: Font;
  fontFamilyName: string;
}

const VariableFontPlayground: React.FC<VariableFontPlaygroundProps> = ({ font, fontFamilyName }) => {
  const axes = useMemo(() => font.variableAxes ?? [], [font.variableAxes]);
  const isVariableFont = font.isVariable && axes.length > 0;

  const initialAxisValues = useMemo(
    () => axes.reduce<Record<string, number>>((v, axis) => ((v[axis.tag] = axis.defaultValue), v), {}),
    [axes]
  );
  const axisKey = useMemo(
    () => axes.map((axis) => `${axis.tag}:${axis.defaultValue}:${axis.minValue}:${axis.maxValue}`).join('|'),
    [axes]
  );
  const cssName = useVariableFontFace(font, fontFamilyName, isVariableFont);

  if (!isVariableFont) {
    return <p className="text-sm opacity-70">This font is not variable or has no defined axes.</p>;
  }

  return (
    <VariableFontPlaygroundControls
      key={axisKey}
      axes={axes}
      cssName={cssName}
      font={font}
      initialAxisValues={initialAxisValues}
    />
  );
};

export default VariableFontPlayground;
