'use client';

import type { ReactNode } from 'react';
import type { Font, VariableAxis } from '@/models/font.models';
import { Button } from '@/components/ui/Button';
import AxisSlider from './AxisSlider';
import TypePlaygroundRange from './TypePlaygroundRange';
import TypePlaygroundStyleSelect from './TypePlaygroundStyleSelect';
import { buildMetricControls, type MetricUnit } from './typePlaygroundModel';

export interface TypePlaygroundControlsProps {
  fonts: Font[];
  selectedStyle: string;
  onStyleChange: (style: string) => void;
  fontSize: number;
  onFontSizeChange: (value: number) => void;
  letterSpacing: number;
  letterSpacingUnit: MetricUnit;
  onLetterSpacingChange: (value: number, typedUnit?: MetricUnit) => void;
  onLetterSpacingUnitChange: (unit: MetricUnit) => void;
  lineHeight: number;
  lineHeightUnit: MetricUnit;
  onLineHeightChange: (value: number, typedUnit?: MetricUnit) => void;
  onLineHeightUnitChange: (unit: MetricUnit) => void;
  axes: VariableAxis[];
  axisValues: Record<string, number>;
  onAxisChange: (tag: string, value: number) => void;
  onReset: () => void;
  onCopy: () => void;
  children?: ReactNode;
}

export default function TypePlaygroundControls(props: TypePlaygroundControlsProps) {
  const {
    fonts, selectedStyle, onStyleChange, axes, axisValues, onAxisChange, onReset, onCopy, children,
  } = props;
  const metrics = buildMetricControls(props);
  const showWeights = fonts.some((font) => font.isVariable);

  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <TypePlaygroundStyleSelect
          fonts={fonts}
          value={selectedStyle}
          onChange={onStyleChange}
          showWeights={showWeights}
        />
        <div className="flex gap-2">
          <Button onClick={onReset} size="sm">Reset</Button>
          <Button onClick={onCopy} size="sm">Copy</Button>
        </div>
      </div>
      {children}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 items-end">
        {metrics.map((metric) => (
          <TypePlaygroundRange key={metric.id} {...metric} />
        ))}
        {axes.map((axis) => (
          <AxisSlider
            key={axis.tag}
            axis={axis}
            value={axisValues[axis.tag] ?? axis.defaultValue}
            onChange={onAxisChange}
          />
        ))}
      </div>
    </>
  );
}
