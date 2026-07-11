'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { LAYOUT, MOVE } from '@/lib/motion/catalogDetailStoryboard';

type SeriphLogoProps = {
  className?: string;
  label?: string;
  /** Shared catalogue↔detail morph (default on). */
  shared?: boolean;
  compact?: boolean;
  move?: { duration: number; ease?: [number, number, number, number] };
};

export default function SeriphLogo({
  className,
  label,
  shared = true,
  move,
}: SeriphLogoProps) {
  const reduce = useReducedMotion();
  const transition = reduce ? { duration: 0 } : (move ?? MOVE);

  const mark = (
    <span
      className={`inline-flex items-center leading-none ${className ?? ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className="block w-full leading-none"
        style={{
          aspectRatio: '193 / 48',
          backgroundColor: 'currentColor',
          maskImage: "url('/seriph-logo.svg')",
          maskPosition: 'center',
          maskRepeat: 'no-repeat',
          maskSize: 'contain',
          WebkitMaskImage: "url('/seriph-logo.svg')",
          WebkitMaskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
        }}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );

  if (!shared) return mark;

  return (
    <motion.span
      layout
      layoutId={LAYOUT.logo}
      className="inline-flex leading-none"
      transition={transition}
    >
      {mark}
    </motion.span>
  );
}
