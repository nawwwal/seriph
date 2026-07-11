import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({ user: { uid: 'user-a' } }));
const navigationState = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('@/components/layout/NavBar', () => ({
  default: () => createElement('nav', { 'data-testid': 'navigation' }, 'Navigation'),
}));
vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('next/navigation', () => ({ usePathname: () => navigationState.pathname }));

import AppFrame from '@/components/layout/AppFrame';

describe('home application frame', () => {
  it('omits global navigation only for the authenticated home shell', () => {
    const home = renderToStaticMarkup(createElement(AppFrame, null, 'Home'));
    navigationState.pathname = '/search';
    const search = renderToStaticMarkup(createElement(AppFrame, null, 'Search'));

    expect(home).not.toContain('data-testid="navigation"');
    expect(search.match(/data-testid="navigation"/g)).toHaveLength(1);
  });
});
