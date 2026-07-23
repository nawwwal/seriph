'use client';

import { useEffect, useRef, useState } from 'react';
import { calculateSpecimenScale } from './specimenInkMetrics';

interface FittedSpecimenLineProps {
  allowGrowth?: boolean;
  children: string;
  className: string;
  frameClassName: string;
  hiddenFromScreenReaders?: boolean;
  minFill?: number;
  onScaleChange?: (scale: number) => void;
  preferredScale?: number;
  targetFill?: number;
}

/** Correct measured outliers while leaving ordinary specimens at their authored size. */
export default function FittedSpecimenLine({
  allowGrowth = false,
  children,
  className,
  frameClassName,
  hiddenFromScreenReaders = false,
  minFill = 0,
  onScaleChange,
  preferredScale = 1,
  targetFill = 0,
}: FittedSpecimenLineProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let frameId = 0;
    const fit = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const frame = frameRef.current;
        const text = textRef.current;
        if (!frame || !text || text.offsetWidth === 0) return;
        const nextScale = calculateSpecimenScale({
          allowGrowth,
          frame,
          minFill,
          preferredScale,
          targetFill,
          text: children,
          textElement: text,
        });
        setScale((current) => Math.abs(current - nextScale) < 0.002 ? current : nextScale);
        onScaleChange?.(nextScale);
      });
    };
    const observer = new ResizeObserver(fit);
    if (frameRef.current) observer.observe(frameRef.current);
    if (textRef.current) observer.observe(textRef.current);
    document.fonts.addEventListener('loadingdone', fit);
    void document.fonts.ready.then(fit);
    fit();

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', fit);
    };
  }, [
    allowGrowth,
    children,
    minFill,
    onScaleChange,
    preferredScale,
    targetFill,
  ]);

  return (
    <div
      ref={frameRef}
      className={`w-full overflow-visible [clip-path:inset(-200%_0_-200%_0)] ${frameClassName}`}
    >
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap ${className}`}
        style={{ transform: `scale(${scale})`, transformOrigin: 'left center' }}
        aria-hidden={hiddenFromScreenReaders || undefined}
      >
        {children}
      </span>
    </div>
  );
}
