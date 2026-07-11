import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('signed-in home shell composition', () => {
  it('provides the approved responsive shell regions and dimensions', () => {
    const shell = read('components/home/HomeShell.tsx');

    expect(shell).toContain("@/components/brand/SeriphLogo");
    expect(shell).toContain('data-home-shell');
    expect(shell).toContain('data-home-header');
    expect(shell).toContain('data-alphabet-rail');
    expect(shell).toContain('data-catalog-canvas');
    expect(shell).toContain('data-status-strip');
    expect(shell).toContain('p-5');
    expect(shell).toContain('md:grid-cols-[368px_minmax(0,1fr)]');
    expect(shell).toContain('md:h-24');
    expect(shell).toContain('min-h-10');
  });

  it('moves alphabet controls from a horizontal scroller to a desktop rail', () => {
    const rail = read('components/home/AlphabetRail.tsx');

    expect(rail).toContain('ALPHABET_INITIALS');
    expect(rail).toContain('overflow-x-auto');
    expect(rail).toContain('md:overflow-y-auto');
    expect(rail).toContain('aria-pressed');
  });

  it('keeps signed-in navigation and catalog actions in the shell header', () => {
    const actions = read('components/home/HomeShellActions.tsx');

    for (const contract of [
      'NavSearch', 'ProfileMenu', 'ThemeSwitcher', 'useUploads',
      'href="/import"', 'onAddFonts', 'onRegenerateCovers',
    ]) expect(actions).toContain(contract);
  });

  it('replaces hero chrome while retaining shelf behavior composition', () => {
    const home = read('components/home/HomePageContent.tsx');
    const shelf = read('components/home/HomePageShelfContent.tsx');

    expect(home).not.toContain("@/components/home/HomeHeader");
    expect(home).not.toContain("@/components/home/HomeFooter");
    for (const contract of [
      'useInfiniteFamilies', 'onCompleted', 'useShelfMutations',
      'useShelfScrollRestoration', 'ShelfSelectionBar',
      'DeleteFamiliesDialog', 'MergeUndoToast', 'filterFamiliesByInitial',
    ]) expect(home).toContain(contract);
    expect(shelf).toContain('<ShelfState');
    expect(shelf).toContain('pendingIngests={pendingIngests}');
    expect(shelf).toContain('selectionState={mutations.selectionState}');
    expect(shelf).toContain('families={families}');
  });

  it('suppresses the global NavBar only on the signed-in home route', () => {
    const frame = read('components/layout/AppFrame.tsx');

    expect(frame).toContain('usePathname');
    expect(frame).toContain("pathname === '/'");
    expect(frame).toContain('showGlobalNav');
    expect(frame).toContain('showGlobalNav && <NavBar />');
  });

});
