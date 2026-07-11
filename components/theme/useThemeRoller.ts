'use client';

import { animate } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { themeMetaList } from '@/lib/theme/themeMeta';
import type { ThemeName } from '@/lib/theme/themes';
import { snapPosition, themeIndex, wrapIndex } from './themeRollerMath';
import { ELASTIC, elasticSnapTarget } from './themeRollerMotion';
import { useThemeRollerGesture } from './useThemeRollerGesture';

/** Continuous drum with velocity-aware elastic snap (overshoot → rest). */
export function useThemeRoller(
  committed: ThemeName,
  onPreview: (theme: ThemeName) => void,
) {
  const n = themeMetaList.length;
  const reduceMotion = useReducedMotion();
  const positionRef = useRef(0);
  const settleAnim = useRef<ReturnType<typeof animate> | null>(null);

  const [position, setPosition] = useState(() =>
    themeIndex(themeMetaList, committed),
  );
  positionRef.current = position;
  const selected = wrapIndex(snapPosition(position), n);

  const setPos = useCallback((next: number) => {
    positionRef.current = next;
    setPosition(next);
  }, []);

  const stopSettle = useCallback(() => {
    settleAnim.current?.stop();
    settleAnim.current = null;
  }, []);

  const settle = useCallback((velocity = 0) => {
    stopSettle();
    const from = positionRef.current;
    const target = elasticSnapTarget(from, velocity);
    if (reduceMotion) {
      setPos(target);
      return;
    }
    settleAnim.current = animate(from, target, {
      ...ELASTIC.settle,
      velocity,
      onUpdate: (value) => setPos(value),
      onComplete: () => setPos(target),
    });
  }, [reduceMotion, setPos, stopSettle]);

  useEffect(() => {
    const item = themeMetaList[selected];
    if (item) onPreview(item.value);
  }, [selected, onPreview]);

  useEffect(() => () => stopSettle(), [stopSettle]);

  const gesture = useThemeRollerGesture(positionRef, setPos, settle, stopSettle);

  const jumpToIndex = useCallback((index: number) => {
    stopSettle();
    const target = wrapIndex(index, n);
    if (reduceMotion) {
      setPos(target);
      return;
    }
    const current = positionRef.current;
    let delta = target - current;
    delta -= n * Math.round(delta / n);
    const end = current + delta;
    settleAnim.current = animate(current, end, {
      ...ELASTIC.settle,
      onUpdate: (value) => setPos(value),
      onComplete: () => setPos(end),
    });
  }, [n, reduceMotion, setPos, stopSettle]);

  const stepBy = useCallback((dir: 1 | -1) => {
    const target = snapPosition(positionRef.current) + dir;
    jumpToIndex(wrapIndex(target, n));
  }, [jumpToIndex, n]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent, onCommit: (theme: ThemeName) => void) => {
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        stepBy(1);
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        stepBy(-1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const item = themeMetaList[selected];
        if (item) onCommit(item.value);
      }
    },
    [selected, stepBy],
  );

  return { position, selected, reduceMotion, jumpToIndex, onKeyDown, ...gesture };
}
