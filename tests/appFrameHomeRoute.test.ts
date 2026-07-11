import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  user: null as null | { uid: string },
  isLoading: false,
}));
const navigationState = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('@/components/layout/NavBar', () => ({
  default: () => createElement('nav', { 'data-testid': 'navigation' }, 'Navigation'),
}));
vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('next/navigation', () => ({ usePathname: () => navigationState.pathname }));
vi.mock('next/dynamic', () => ({
  default: () =>
    function MockRuntime({ children }: { children?: React.ReactNode }) {
      return createElement('div', { 'data-shell-runtime': true }, children);
    },
}));

import AppFrame from '@/components/layout/AppFrame';

describe('home application frame', () => {
  it('omits global navigation for authenticated workspaces', () => {
    authState.user = { uid: 'user-a' };
    navigationState.pathname = '/';
    const home = renderToStaticMarkup(createElement(AppFrame, null, 'Home'));
    navigationState.pathname = '/search';
    const search = renderToStaticMarkup(createElement(AppFrame, null, 'Search'));

    expect(home).not.toContain('data-testid="navigation"');
    expect(search).not.toContain('data-testid="navigation"');
    expect(home).toContain('data-app-frame="workspace"');
    expect(search).toContain('data-app-frame="workspace"');
  });

  it('shows global navigation for public unauthenticated routes', () => {
    authState.user = null;
    navigationState.pathname = '/';
    const publicHome = renderToStaticMarkup(createElement(AppFrame, null, 'Public'));
    expect(publicHome).toContain('data-testid="navigation"');
    expect(publicHome).toContain('data-app-frame="public"');
  });
});
