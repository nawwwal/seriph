import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('home visual polish', () => {
  it('keeps Import as the single populated-shelf add action', () => {
    expect(read('components/home/ShelfState.tsx')).not.toContain('AddFontsCard');
  });

  it('removes card lift when reduced motion is requested', () => {
    const utilities = read('styles/utilities-base.css');

    expect(utilities).toContain('@media (prefers-reduced-motion: reduce)');
    expect(utilities).toMatch(/\.seriph-card-hover:hover\s*\{\s*transform: none;/);
  });
});
