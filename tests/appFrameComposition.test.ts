import fs from 'node:fs';
import path from 'node:path';
import { Children, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const uploadState = vi.hoisted(() => ({ isOpen: false }));
const authState = vi.hoisted<{ user: null | { uid: string } }>(() => ({ user: null }));

vi.mock('@/components/layout/NavBar', () => ({
  default: () => createElement('nav', { 'data-testid': 'navigation' }, 'Navigation'),
}));
vi.mock('@/lib/contexts/UploadContext', () => ({
  useUploads: () => uploadState,
}));
vi.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));
vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, _options: { ssr: boolean }) =>
    function MockUploadCenterModal() {
      return createElement('dialog', { 'data-testid': 'upload-center-modal' }, 'Uploads');
    },
}));

import AppFrame from '@/components/layout/AppFrame';
import UploadCenterOverlay from '@/components/upload/UploadCenterOverlay';

const repoRoot = process.cwd();
const workspaceRoutes = [
  'components/layout/CenteredShell.tsx',
  'components/home/HomePageContent.tsx',
  'components/home/LandingPage.tsx',
  'app/login/page.tsx',
  'app/(main)/search/page.tsx',
  'app/(main)/import/page.tsx',
  'app/(main)/family/[familyId]/page.tsx',
];

function read(file: string): string {
  const filePath = path.join(repoRoot, file);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

afterEach(() => {
  uploadState.isOpen = false;
  authState.user = null;
});

describe('persistent application frame', () => {
  it('renders one navigation boundary followed by every route child', () => {
    const routeChildren = [
      createElement('main', { key: 'primary' }, 'Primary route content'),
      createElement('aside', { key: 'secondary' }, 'Secondary route content'),
    ];

    const markup = renderToStaticMarkup(createElement(AppFrame, null, routeChildren));

    expect(Children.count(routeChildren)).toBe(2);
    expect(markup.match(/data-testid="navigation"/g)).toHaveLength(1);
    expect(markup).toMatch(/<nav[^>]*>Navigation<\/nav><main[^>]*>Primary route content<\/main><aside/);
  });

  it('allows public routes to use document scrolling', () => {
    const markup = renderToStaticMarkup(
      createElement(AppFrame, null, createElement('main', null, 'Public route content'))
    );
    const frameClass = markup.match(/^<div class="([^"]+)"/)?.[1]?.split(' ') ?? [];

    expect(frameClass).toContain('min-h-screen');
    expect(frameClass).not.toContain('h-screen');
    expect(frameClass).not.toContain('overflow-hidden');
  });

  it('keeps authenticated workspace routes on a fixed internal scroll frame', () => {
    authState.user = { uid: 'user-a' };

    const markup = renderToStaticMarkup(
      createElement(AppFrame, null, createElement('main', null, 'Workspace route content'))
    );
    const frameClass = markup.match(/^<div class="([^"]+)"/)?.[1]?.split(' ') ?? [];

    expect(frameClass).toContain('h-screen');
    expect(frameClass).toContain('overflow-hidden');
  });

  it('places NavBar in one root AppFrame and not in workspace route modules', () => {
    expect(read('app/layout.tsx')).toContain('<AppFrame>');
    expect(read('components/layout/AppFrame.tsx')).toContain('<NavBar />');

    for (const file of workspaceRoutes) {
      expect(read(file), file).not.toMatch(/(?:@\/components\/layout\/NavBar|\.\/NavBar)/);
    }
  });

  it('keeps UploadCenterModal behind an interaction-bound dynamic import', () => {
    const layout = read('app/layout.tsx');
    const overlay = read('components/upload/UploadCenterOverlay.tsx');

    expect(overlay).toContain("dynamic(() => import('./UploadCenterModal')");
    expect(overlay).toContain('ssr: false');
    expect(overlay).toContain('isOpen');
    expect(layout).toContain('<UploadCenterOverlay />');
    expect(layout).not.toContain('UploadCenterModal');
  });

  it('renders the deferred Upload Center only while the upload state is open', () => {
    expect(renderToStaticMarkup(createElement(UploadCenterOverlay))).toBe('');

    uploadState.isOpen = true;

    expect(renderToStaticMarkup(createElement(UploadCenterOverlay))).toContain(
      'data-testid="upload-center-modal"'
    );
  });
});
