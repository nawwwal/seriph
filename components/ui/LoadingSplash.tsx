'use client';

import SplashWordmark from './SplashWordmark';

interface LoadingSplashProps {
  className?: string;
  text?: string;
  word?: string;
}

export default function LoadingSplash({
  className,
  text = 'Loading Seriph...',
  word = 'SERIPH',
}: LoadingSplashProps) {
  const rootClassName = ['loading-splash p-4', className].filter(Boolean).join(' ');

  return (
    <div aria-live="polite" className={rootClassName} role="status">
      <SplashWordmark className="text-5xl sm:text-6xl md:text-7xl" decorative word={word} />
      <span className="sr-only">{text}</span>
    </div>
  );
}
