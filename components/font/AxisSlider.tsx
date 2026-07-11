'use client';

import type { VariableAxis } from '@/models/font.models';
import ElasticSlider from '@/components/ui/ElasticSlider';

export default function AxisSlider({
  axis,
  value,
  onChange,
}: {
  axis: VariableAxis;
  value: number;
  onChange: (tag: string, value: number) => void;
}) {
  const range = axis.maxValue - axis.minValue;
  const step = axis.tag === 'wght' || range > 100 ? 1 : range / 100;
  return (
    <ElasticSlider
      id={`slider-${axis.tag}`}
      label={`${axis.name} (${axis.tag})`}
      min={axis.minValue}
      max={axis.maxValue}
      step={step}
      value={value}
      onChange={(next) => onChange(axis.tag, next)}
      ariaLabel={`${axis.name} (${axis.tag})`}
      ariaValueText={`${axis.name} ${value}`}
    />
  );
}
