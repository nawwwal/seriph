'use client';

import { Select } from '@base-ui/react/select';
import { motion, useReducedMotion } from 'framer-motion';
import type { ThemeMeta } from '@/lib/theme/themeMeta';
import ThemeSwatch from './ThemeSwatch';

interface ThemeSwitcherTriggerProps {
  open: boolean;
  current: ThemeMeta;
}

/** Compact archive trigger — chip + name, soft open wiggle. */
export default function ThemeSwitcherTrigger({ open, current }: ThemeSwitcherTriggerProps) {
  const reduceMotion = useReducedMotion();
  const spring = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 500, damping: 16 };

  return (
    <Select.Trigger
      type="button"
      aria-label={`Theme ${current.label}`}
      aria-expanded={open}
      className="inline-flex h-6 items-center gap-1.5 rounded-full bg-transparent px-0.5 text-left text-[var(--ink)] outline-none focus:outline-none focus-visible:outline-none"
    >
      <motion.span
        className="inline-flex items-center gap-1.5"
        whileHover={reduceMotion ? undefined : { scale: 1.04, y: -1 }}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        animate={open && !reduceMotion ? { rotate: [0, -5, 5, 0] } : { rotate: 0 }}
        transition={
          open && !reduceMotion
            ? { duration: 0.35, ease: 'easeInOut' }
            : spring
        }
      >
        <ThemeSwatch theme={current.value} size="chip" />
        <span
          className="text-xs uppercase tracking-wide"
          style={{
            fontFamily: 'var(--font-league-spartan), system-ui, sans-serif',
            fontVariationSettings: "'wght' 700",
            fontWeight: 700,
          }}
        >
          {current.label}
        </span>
      </motion.span>
    </Select.Trigger>
  );
}
