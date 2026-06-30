'use client';

import type { CSSProperties } from 'react';

/* ---------------------------------------------------------
 * ANIMATION STORYBOARD
 *
 * Read top-to-bottom. Each `at` value is ms after mount.
 *
 *    0ms   S starts at baseline and lifts
 *   82ms   E follows S, creating the first wave offset
 *  164ms   R follows E with the same rise/fall arc
 *  246ms   I follows R, keeping the motion continuous
 *  328ms   P follows I, preserving the left-to-right wave
 *  410ms   H follows P, then all letters settle before loop
 * 1350ms   wave loops from the first letter
 * --------------------------------------------------------- */

const DEFAULT_WORD = 'SERIPH';

type SplashLetterStyle = CSSProperties & {
  '--wave-index': number;
};

interface SplashWordmarkProps {
  className?: string;
  decorative?: boolean;
  word?: string;
}

function letterStyle(index: number): SplashLetterStyle {
  return { '--wave-index': index };
}

export default function SplashWordmark({
  className,
  decorative = false,
  word = DEFAULT_WORD,
}: SplashWordmarkProps) {
  const rootClassName = ['splash-wordmark', className].filter(Boolean).join(' ');

  return (
    <span aria-hidden={decorative || undefined} aria-label={decorative ? undefined : word} className={rootClassName}>
      {Array.from(word).map((letter, index) => (
        <span aria-hidden="true" className="splash-wordmark-letter" key={`${letter}-${index}`} style={letterStyle(index)}>
          {letter}
        </span>
      ))}
    </span>
  );
}
