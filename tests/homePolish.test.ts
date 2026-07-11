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

  it('keeps two columns until the wider desktop breakpoint', () => {
    const grid = read('components/home/shelfGrid.ts');

    expect(grid).toContain('sm:grid-cols-2 xl:grid-cols-3');
    expect(grid).not.toContain('lg:grid-cols-3');
  });

  it('uses dynamic letters and one full-width Import action', () => {
    const rail = read('components/home/AlphabetRail.tsx');

    expect(rail).toContain('availableInitials');
    expect(rail).toContain('availableInitials.length > 0');
    expect(rail).toContain('className="w-full');
    expect(rail).not.toContain('Browse by alphabet');
    expect(rail).not.toContain('>All</button>');
  });

  it('only includes the Uploads metric while uploads are active', () => {
    const status = read('components/home/ShelfStats.tsx');

    expect(status).toContain('pendingCount > 0');
  });
});
