'use client';

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { clientXToValue, snap, valueToPct } from './elasticSliderMath';
import ElasticSliderValue from './ElasticSliderValue';

export interface ElasticSliderProps {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number, typedUnit?: string) => void;
  unit?: string;
  units?: string[];
  onUnitChange?: (unit: string) => void;
  ariaLabel?: string;
}

export default function ElasticSlider({
  id, label, min, max, step, value, onChange, unit, units, onUnitChange, ariaLabel,
}: ElasticSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const reduceMotion = useReducedMotion();
  const pct = valueToPct(value, min, max);
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: active ? 520 : 360, damping: active ? 28 : 16, mass: 0.75 };

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      onChange(clientXToValue(clientX, el.getBoundingClientRect(), min, max, step));
    },
    [max, min, onChange, step]
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
    setFromClientX(e.clientX);
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setActive(false);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    onChange(snap(value + dir * (e.shiftKey ? step * 10 : step), min, max, step));
  };

  return (
    <div className="elastic-slider" data-active={active ? 'true' : 'false'} style={{ ['--elastic-pct' as string]: `${pct}%` }}>
      <div className="elastic-slider__head">
        <label htmlFor={id} className="elastic-slider__label">{label}</label>
        <motion.div animate={{ y: active ? -1 : 0 }} transition={transition}>
          <ElasticSliderValue
            inputId={id}
            value={value}
            min={min}
            max={max}
            step={step}
            unit={unit}
            units={units}
            onChange={onChange}
            onUnitChange={onUnitChange}
          />
        </motion.div>
      </div>
      <div
        ref={trackRef}
        id={id}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={ariaLabel || label}
        className="elastic-slider__track-hit"
        onPointerDown={onPointerDown}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) setFromClientX(e.clientX);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <div className="elastic-slider__track"><div className="elastic-slider__fill" /></div>
        <motion.div className="elastic-slider__thumb" animate={{ y: active ? -2 : 0, scale: active ? 1.04 : 1 }} transition={transition} aria-hidden="true">
          <span className="elastic-slider__grip" />
          <span className="elastic-slider__grip" />
          <span className="elastic-slider__grip" />
        </motion.div>
      </div>
    </div>
  );
}
