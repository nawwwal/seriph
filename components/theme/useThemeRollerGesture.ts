'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GESTURE, clampVelocity } from './themeRollerMotion';

type Sample = { t: number; pos: number };

function velocityFromSamples(samples: Sample[]): number {
  if (samples.length < 2) return 0;
  const a = samples[0];
  const b = samples[samples.length - 1];
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0.001) return 0;
  return clampVelocity((b.pos - a.pos) / dt);
}

/** Wheel + pointer with velocity samples for elastic settle. */
export function useThemeRollerGesture(
  positionRef: React.MutableRefObject<number>,
  setPos: (next: number) => void,
  settle: (velocity?: number) => void,
  stopSettle: () => void,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<null | { y: number; pos: number }>(null);
  const samples = useRef<Sample[]>([]);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWheelT = useRef(0);
  const [dragging, setDragging] = useState(false);

  const pushSample = (pos: number) => {
    const t = performance.now();
    samples.current.push({ t, pos });
    if (samples.current.length > GESTURE.sampleWindow) {
      samples.current.shift();
    }
  };

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    };
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      stopSettle();
      const delta =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (Math.abs(delta) < 1) return;
      const next = positionRef.current + delta / GESTURE.pxPerFace;
      setPos(next);
      pushSample(next);
      lastWheelT.current = performance.now();
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => {
        settle(velocityFromSamples(samples.current));
        samples.current = [];
      }, GESTURE.wheelIdleMs);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [positionRef, setPos, settle, stopSettle]);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    stopSettle();
    samples.current = [];
    drag.current = { y: event.clientY, pos: positionRef.current };
    pushSample(positionRef.current);
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [positionRef, stopSettle]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = event.clientY - drag.current.y;
    const next = drag.current.pos + dy / GESTURE.pxPerFace;
    setPos(next);
    pushSample(next);
  }, [setPos]);

  const endDrag = useCallback((event: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { /* released */ }
    const v = velocityFromSamples(samples.current);
    samples.current = [];
    settle(v);
  }, [settle]);

  return { rootRef, dragging, onPointerDown, onPointerMove, endDrag };
}
