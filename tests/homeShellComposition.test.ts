import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { User } from 'firebase/auth';
import './helpers/homeShellMocks';
import HomePageContent from '@/components/home/HomePageContent';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const has = (file: string, tokens: string[]) => {
  const src = read(file);
  for (const t of tokens) expect(src).toContain(t);
};

describe('signed-in home shell composition', () => {
  it('renders the shell and every supplied home region', () => {
    const markup = renderToStaticMarkup(
      createElement(HomePageContent, { user: { uid: 'user-a' } as User }),
    );
    expect(markup).toContain('data-home-shell');
    expect(markup).toContain('data-app-shell');
    for (const slot of ['alphabet', 'catalog', 'status']) {
      expect(markup).toContain(`data-slot="${slot}"`);
    }
  });

  it('composes shelf body on shared AppShell regions', () => {
    has('components/layout/AppShell.tsx', [
      'AppShellHeader', 'data-home-shell', 'data-app-shell',
      'data-status-strip', 'MotionBody', 'MotionCanvas', 'MotionRail',
    ]);
    has('components/motion/shellMotionParts.tsx', ['data-catalog-canvas', 'layoutId']);
    has('components/layout/AppShellHeader.tsx', [
      'AppShellLogoLink', 'HomeHeaderSearch', 'h-20', 'h-10', 'MotionHeader',
    ]);
    has('components/layout/AppShellLogoLink.tsx', ['SeriphLogo', 'sm:w-[193px]']);
    has('components/home/HomeShell.tsx', ['AppShell', 'sidebar={alphabetRail}']);
  });

  it('renders the full five-column alphabet matrix with present-state disable', () => {
    has('components/home/AlphabetRail.tsx', [
      'LETTER_INITIALS.map', 'presentInitials', 'grid-cols-5', 'aspect-square',
      'ShelfFilterChips', 'aria-pressed',
    ]);
  });

  it('contains mobile rail and catalog widths inside the clipped shell', () => {
    for (const file of [
      'components/home/HomeCatalogCanvas.tsx', 'components/layout/AppShell.tsx',
      'components/home/AlphabetRail.tsx',
    ]) has(file, ['min-w-0', 'w-full']);
  });

  it('keeps account controls in the status strip with profile rightmost', () => {
    const status = read('components/layout/AppStatusStrip.tsx');
    expect(status.indexOf('ThemeSwitcher')).toBeLessThan(status.indexOf('ProfileMenu'));
  });

  it('replaces hero chrome while retaining shelf behavior composition', () => {
    has('components/home/HomePageContent.tsx', ['useHomeShelfView', 'HomeCatalogCanvas']);
    has('components/home/HomePageShelfContent.tsx', ['<ShelfState']);
  });

  it('suppresses the global NavBar for signed-in workspaces', () => {
    const frame = read('components/layout/AppFrame.tsx');
    expect(frame).toContain('isSignedInWorkspace');
    expect(frame).not.toContain('showPublicNav');
  });
});
