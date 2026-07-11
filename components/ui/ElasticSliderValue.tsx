'use client';

import { useState } from 'react';
import { snapSliderValue } from './elasticSliderMath';

interface ElasticSliderValueProps {
  inputId: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

function formatValue(value: number, step: number): string {
  if (step >= 1) return String(Math.round(value));
  return String(Number(value.toFixed(step >= 0.1 ? 1 : 2)));
}

export default function ElasticSliderValue({
  inputId,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: ElasticSliderValueProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayedValue = draft ?? formatValue(value, step);

  const commit = () => {
    const parsed = Number(displayedValue.trim());
    if (!Number.isFinite(parsed)) {
      setDraft(null);
      return;
    }
    const next = snapSliderValue(parsed, min, max, step);
    setDraft(null);
    onChange(next);
  };

  return (
    <div className="elastic-slider__value">
      <input
        id={`${inputId}-value`}
        className="elastic-slider__value-input"
        value={displayedValue}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
        inputMode="decimal"
        aria-label="Numeric value"
        spellCheck={false}
      />
      {unit ? <span className="elastic-slider__unit">{unit}</span> : null}
    </div>
  );
}
