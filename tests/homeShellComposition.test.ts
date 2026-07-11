import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/contexts/UploadContext', () => ({
  useUploads: () => ({ ingests: [], onCompleted: () => vi.fn() }),
}));
vi.mock('@/lib/hooks/useInfiniteFamilies', () => ({
  clearShelfFamilyCache: vi.fn(),
  useInfiniteFamilies: () => ({ families: [], stats: null, reload: vi.fn(), isInitialLoading: false, hasMore: false, isLoadingMore: false, isRefreshing: false, error: null, loadMore: vi.fn() }),
}));
vi.mock('@/lib/hooks/useShelfScrollRestoration', () => ({ useShelfScrollRestoration: () => vi.fn() }));
vi.mock('@/lib/hooks/useShelfMutations', () => ({
  useShelfMutations: () => ({ selectionState: { mode: 'idle' }, selectedFamilyIds: [], selectionCanMerge: vi.fn(), isMutating: false, mutationError: null, pendingDeleteIds: null, mergeUndo: null }),
}));
vi.mock('@/components/home/AlphabetRail', () => ({ default: () => createElement('div', { 'data-slot': 'alphabet' }) }));
vi.mock('@/components/home/ShelfStats', () => ({ default: () => createElement('div', { 'data-slot': 'status' }) }));
vi.mock('@/components/home/HomePageShelfContent', () => ({ default: () => createElement('div', { 'data-slot': 'catalog' }) }));

import HomePageContent from '@/components/home/HomePageContent';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('signed-in home shell composition', () => {
  it('renders the shell and every supplied home region', () => {
    const user = { uid: 'user-a' } as User;
    const markup = renderToStaticMarkup(createElement(HomePageContent, { user }));

    expect(markup).toContain('data-home-shell');
    for (const slot of ['alphabet', 'catalog', 'status']) {
      expect(markup).toContain(`data-slot="${slot}"`);
    }
  });

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

  it('keeps the header logo-only and moves account controls to status', () => {
    const home = read('components/home/HomePageContent.tsx');
    const shell = read('components/home/HomeShell.tsx');
    const status = read('components/home/ShelfStats.tsx');

    expect(shell).not.toContain('headerActions');
    expect(home).not.toContain('HomeShellActions');
    expect(home).not.toContain('shelfMode');
    expect(home).not.toContain('coverSeed');
    expect(status).toContain('ThemeSwitcher');
    expect(status).toContain('ProfileMenu');
    expect(status).not.toContain('Shelf mode');
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
