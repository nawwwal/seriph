'use client';

import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import ElasticSliderValue from './ElasticSliderValue';
import { keyboardSliderValue, pointerValue, snapSliderValue, valueToPercentage } from './elasticSliderMath';

interface SliderStyle extends CSSProperties {
  '--elastic-pct': string;
}

export interface ElasticSliderProps {
  id: string; label: string;
  min: number; max: number; step: number; value: number;
  onChange: (value: number) => void;
  unit?: string; ariaLabel?: string; ariaValueText?: string;
}

export default function ElasticSlider({
  id, label, min, max, step, value, onChange, unit, ariaLabel, ariaValueText,
}: ElasticSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const reduceMotion = useReducedMotion();
  const normalizedValue = snapSliderValue(value, min, max, step);
  const style: SliderStyle = { '--elastic-pct': `${valueToPercentage(normalizedValue, min, max)}%` };
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: active ? 520 : 360, damping: active ? 28 : 20 };

  const updateFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (track) onChange(pointerValue(clientX, track.getBoundingClientRect(), min, max, step));
    },
    [max, min, onChange, step]
  );

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setActive(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = keyboardSliderValue({ key: event.key, value: normalizedValue, min, max, step, shiftKey: event.shiftKey });
    if (next === null) return;
    event.preventDefault();
    onChange(next);
  };

  return (
    <div className="elastic-slider" data-active={active ? 'true' : 'false'} style={style}>
      <div className="elastic-slider__head">
        <label htmlFor={id} className="elastic-slider__label">{label}</label>
        <motion.div animate={{ y: active ? -1 : 0 }} transition={transition}>
          <ElasticSliderValue inputId={id} label={label} value={normalizedValue} min={min} max={max} step={step} unit={unit} onChange={onChange} />
        </motion.div>
      </div>
      <div
        ref={trackRef}
        id={id}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={normalizedValue}
        aria-valuetext={ariaValueText ?? `${normalizedValue}${unit ?? ''}`}
        aria-label={ariaLabel ?? label}
        className="elastic-slider__track-hit"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setActive(true);
          updateFromPointer(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event.clientX);
        }}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onKeyDown={handleKeyDown}
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
