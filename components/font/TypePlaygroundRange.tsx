'use client';

import ElasticSlider from '@/components/ui/ElasticSlider';
import type { MetricControl } from './typePlaygroundModel';

export default function TypePlaygroundRange(props: MetricControl) {
  return (
    <ElasticSlider
      id={props.id}
      label={props.label}
      min={props.min}
      max={props.max}
      step={props.step}
      value={props.value}
      onChange={props.onChange}
      unit={props.unit}
      units={props.units}
      onUnitChange={props.onUnitChange}
    />
  );
}
