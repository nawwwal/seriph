import { createElement } from 'react';
import { vi } from 'vitest';

/** Side-effect mocks for home shell composition tests (import for effect). */

vi.mock('@/lib/hooks/useShelfScrollRestoration', () => ({
  useShelfScrollRestoration: () => vi.fn(),
}));
vi.mock('@/components/home/HomeHeaderSearch', () => ({ default: () => null }));
vi.mock('@/components/layout/AppShellLogoLink', () => ({
  default: () => createElement('a', { 'data-slot': 'logo' }, 'Seriph'),
}));
vi.mock('@/components/layout/AppShellHeader', () => ({
  default: () => createElement('header', { 'data-home-header': true }, 'header'),
}));

const passthrough = ({ children }: { children?: React.ReactNode }) => children ?? null;

vi.mock('@/components/motion/shellMotion', () => ({
  ShellLayout: passthrough,
  MotionBody: passthrough,
  MotionCanvas: ({ children }: { children?: React.ReactNode }) =>
    createElement('div', { 'data-catalog-canvas': true }, children),
  MotionRail: passthrough,
  MotionHeader: passthrough,
  MotionSlot: ({ children, show }: { children?: React.ReactNode; show?: boolean }) =>
    (show ? children : null),
  useShellMove: () => ({ duration: 0 }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useParams: () => ({}),
}));
vi.mock('@/components/home/useHomeShelfView', () => ({
  useHomeShelfView: () => ({
    shelf: {
      families: [], stats: null, reload: vi.fn(), isInitialLoading: false,
      hasMore: false, isLoadingMore: false, error: null, loadMore: vi.fn(),
    },
    mutations: {
      selectionState: { mode: 'idle' }, selectedFamilyIds: [],
      selectionCanMerge: vi.fn(), isMutating: false, mutationError: null,
      pendingDeleteIds: null, mergeUndo: null,
      setPendingDeleteIds: vi.fn(), setMergeUndo: vi.fn(),
    },
    pendingIngests: [], uploadCount: 0, openUploadCenter: vi.fn(),
    handleAddFonts: vi.fn(), handleFilesSelected: vi.fn(),
    activeInitial: 'ALL', setSelectedInitial: vi.fn(),
    presentInitials: new Set(),
    filters: { classifications: [], moods: [], variable: 'any' },
    setFilters: vi.fn(), moods: [], visibleFamilies: [],
    showShelfSkeleton: false, isEmpty: true, hasBlockingError: false,
  }),
}));

const slot = (name: string) => () => createElement('div', { 'data-slot': name });
vi.mock('@/components/home/AlphabetRail', () => ({ default: slot('alphabet') }));
vi.mock('@/components/home/ShelfStats', () => ({ default: slot('status') }));
vi.mock('@/components/home/HomeCatalogCanvas', () => ({ default: slot('catalog') }));
vi.mock('@/components/layout/AppStatusStrip', () => ({
  default: ({ children }: { children?: React.ReactNode }) =>
    createElement('div', { 'data-testid': 'status-strip' }, children),
}));
