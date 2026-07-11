import fs from 'node:fs';
import path from 'node:path';
import { Children, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const uploadState = vi.hoisted(() => ({ isOpen: false }));
const authState = vi.hoisted<{ user: null | { uid: string }; isLoading: boolean }>(() => ({
  user: null,
  isLoading: false,
}));
const navigationState = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('@/components/layout/NavBar', () => ({
  default: () => createElement('nav', { 'data-testid': 'navigation' }, 'Navigation'),
}));
vi.mock('@/lib/contexts/UploadContext', () => ({ useUploads: () => uploadState }));
vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('next/navigation', () => ({ usePathname: () => navigationState.pathname }));
vi.mock('next/dynamic', () => ({
  default: () => function MockUploadCenterModal() {
    return createElement('dialog', { 'data-testid': 'upload-center-modal' }, 'Uploads');
  },
}));

import AppFrame from '@/components/layout/AppFrame';
import UploadCenterOverlay from '@/components/upload/UploadCenterOverlay';

const read = (file: string) => {
  const filePath = path.join(process.cwd(), file);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
};

afterEach(() => {
  uploadState.isOpen = false;
  authState.user = null;
  authState.isLoading = false;
  navigationState.pathname = '/';
});

describe('persistent application frame', () => {
  it('does not flash legacy NavBar while auth is resolving', () => {
    authState.isLoading = true;
    const markup = renderToStaticMarkup(
      createElement(AppFrame, null, createElement('main', null, 'Boot')),
    );
    expect(markup).toContain('data-app-frame="loading"');
    expect(markup).not.toContain('data-testid="navigation"');
    expect(markup).toContain('h-screen');
  });

  it('renders signed-in workspaces without a global NavBar', () => {
    authState.user = { uid: 'user-a' };
    navigationState.pathname = '/search';
    const kids = [
      createElement('main', { key: 'a' }, 'Primary'),
      createElement('aside', { key: 'b' }, 'Secondary'),
    ];
    const markup = renderToStaticMarkup(createElement(AppFrame, null, kids));
    expect(Children.count(kids)).toBe(2);
    expect(markup).not.toContain('data-testid="navigation"');
    expect(markup).toContain('data-app-frame="workspace"');
    expect(markup).toContain('Primary');
  });

  it('allows public routes document scroll with NavBar', () => {
    const markup = renderToStaticMarkup(
      createElement(AppFrame, null, createElement('main', null, 'Public')),
    );
    expect(markup).toContain('data-app-frame="public"');
    expect(markup).toContain('min-h-screen');
    expect(markup).toContain('data-testid="navigation"');
  });

  it('keeps authenticated workspaces on a fixed internal scroll frame', () => {
    authState.user = { uid: 'user-a' };
    navigationState.pathname = '/import';
    const markup = renderToStaticMarkup(
      createElement(AppFrame, null, createElement('main', null, 'Workspace')),
    );
    expect(markup).toContain('h-screen');
    expect(markup).toContain('overflow-hidden');
  });

  it('uses AppShell on signed-in routes and keeps NavBar out of modules', () => {
    expect(read('app/layout.tsx')).toContain('<AppFrame>');
    expect(read('components/layout/AppShell.tsx')).toContain('data-app-shell');
    expect(fs.existsSync(path.join(process.cwd(), 'components/home/HomeHeader.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'components/home/HomeFooter.tsx'))).toBe(false);
    for (const file of [
      'app/(main)/search/page.tsx',
      'app/(main)/import/page.tsx',
      'app/(main)/family/[familyId]/page.tsx',
    ]) expect(read(file)).toContain('AppShell');
  });

  it('keeps UploadCenterModal behind interaction-bound dynamic import', () => {
    const overlay = read('components/upload/UploadCenterOverlay.tsx');
    expect(overlay).toContain("dynamic(() => import('./UploadCenterModal')");
    expect(read('app/layout.tsx')).toContain('<UploadCenterOverlay />');
  });

  it('renders Upload Center only while open', () => {
    expect(renderToStaticMarkup(createElement(UploadCenterOverlay))).toBe('');
    uploadState.isOpen = true;
    expect(renderToStaticMarkup(createElement(UploadCenterOverlay))).toContain('upload-center-modal');
  });
});
