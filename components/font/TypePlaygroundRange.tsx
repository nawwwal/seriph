'use client';

import type { ReactNode } from 'react';
import ElasticSlider from '@/components/ui/ElasticSlider';

interface TypePlaygroundRangeProps {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  ariaValueText?: string;
  onChange: (value: number) => void;
  /** Placed left of the value input (unit mode toggles). */
  valuePrefix?: ReactNode;
}

export default function TypePlaygroundRange(props: TypePlaygroundRangeProps) {
  return <ElasticSlider {...props} />;
}
