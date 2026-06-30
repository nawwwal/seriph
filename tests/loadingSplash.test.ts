import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readRepoFile(file: string): string {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

describe('loading splash', () => {
  it('uses the wave wordmark on auth splash gates', () => {
    expect(readRepoFile('app/page.tsx')).toContain('<LoadingSplash text="Loading Seriph..." />');
    expect(readRepoFile('app/login/page.tsx')).toContain('<LoadingSplash text="Loading Seriph..." />');
    expect(readRepoFile('app/(main)/search/page.tsx')).toContain('<LoadingSplash text="Loading Seriph..." />');
  });

  it('keeps the wordmark animation storyboarded and data-driven', () => {
    const source = readRepoFile('components/ui/SplashWordmark.tsx');

    expect(source).toContain('ANIMATION STORYBOARD');
    expect(source).toContain("const DEFAULT_WORD = 'SERIPH';");
    expect(source).toContain('Array.from(word).map');
    expect(source).toContain("'--wave-index': number");
  });

  it('animates only transform and respects reduced motion', () => {
    const styles = readRepoFile('styles/utilities-splash.css');

    expect(styles).toContain('animation-delay: calc(var(--wave-index) * var(--splash-wave-stagger));');
    expect(styles).toContain('transform: translate3d(0, var(--splash-wave-rise), 0);');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).not.toContain('top:');
    expect(styles).not.toContain('margin-top');
  });
});
