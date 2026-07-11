'use client';

import { useEffect, useState } from 'react';
import { clamp, snap } from './elasticSliderMath';

interface ElasticSliderValueProps {
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  units?: string[];
  /** Value commit. Optional unit when the user typed a unit suffix (Figma-style). */
  onChange: (value: number, typedUnit?: string) => void;
  /** Unit cycle via button (parent may convert value). */
  onUnitChange?: (unit: string) => void;
  inputId: string;
}

function formatNum(value: number, step: number): string {
  if (step >= 1) return String(Math.round(value));
  if (step >= 0.1) return value.toFixed(1);
  return value.toFixed(2);
}

/** Parse "53", "53px", "48 %", "-2.5PX" into value + optional unit. */
export function parseTypedValue(raw: string): { value: number; unit?: string } | null {
  const match = raw.trim().match(/^(-?\d*\.?\d+)\s*(px|%)?$/i);
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  const suffix = match[2]?.toLowerCase();
  const unit = suffix === 'px' || suffix === '%' ? suffix : undefined;
  return { value: n, unit };
}

export default function ElasticSliderValue({
  value, min, max, step, unit, units, onChange, onUnitChange, inputId,
}: ElasticSliderValueProps) {
  const [draft, setDraft] = useState(() => formatNum(value, step));

  useEffect(() => {
    setDraft(formatNum(value, step));
  }, [value, step, unit]);

  const commit = () => {
    const parsed = parseTypedValue(draft);
    if (!parsed) {
      setDraft(formatNum(value, step));
      return;
    }
    const typedUnit =
      parsed.unit && units?.includes(parsed.unit) ? parsed.unit : undefined;
    // Typed unit: use the number as written in that unit (no conversion).
    if (typedUnit && typedUnit !== unit) {
      onChange(parsed.value, typedUnit);
      setDraft(formatNum(parsed.value, step));
      return;
    }
    const next = snap(clamp(parsed.value, min, max), min, max, step);
    onChange(next);
    setDraft(formatNum(next, step));
  };

  const cycleUnit = () => {
    if (!units?.length || !unit || !onUnitChange) return;
    const i = units.indexOf(unit);
    onUnitChange(units[(i + 1) % units.length] ?? units[0]);
  };

  return (
    <div className="elastic-slider__value">
      <input
        id={`${inputId}-value`}
        className="elastic-slider__value-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(formatNum(value, step));
            e.currentTarget.blur();
          }
        }}
        inputMode="decimal"
        aria-label="Numeric value"
        spellCheck={false}
      />
      {unit && (
        <button
          type="button"
          className="elastic-slider__unit"
          onClick={cycleUnit}
          disabled={!units || units.length < 2}
          aria-label={units && units.length > 1 ? `Unit ${unit}, click to switch` : `Unit ${unit}`}
          title={units && units.length > 1 ? 'Type 48% or 48px, or click to switch' : undefined}
        >
          {unit}
        </button>
      )}
    </div>
  );
}
