import fs from 'node:fs';
import path from 'node:path';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, options?: { loading?: ComponentType }) => options?.loading ?? (() => null),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/import/ImportFooter', () => ({ default: () => createElement('footer') }));
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children }: { children?: ReactNode }) => createElement('button', null, children),
}));
vi.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-a' }, isLoading: false }),
}));
vi.mock('@/lib/contexts/UploadContext', () => ({ useUploads: () => ({ open: vi.fn() }) }));
vi.mock('framer-motion', () => {
  const React = require('react') as typeof import('react');
  const passthrough = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('div', props, children);
  return {
    motion: new Proxy(
      {},
      {
        get: () => passthrough,
      },
    ),
    LayoutGroup: passthrough,
    useReducedMotion: () => true,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children ?? null,
  };
});
vi.mock('@/components/motion/shellMotion', () => {
  const React = require('react') as typeof import('react');
  const pass = ({ children }: { children?: React.ReactNode }) => children ?? null;
  return {
    MotionBody: pass,
    MotionCanvas: pass,
    MotionRail: pass,
    MotionHeader: pass,
    MotionSlot: pass,
    useShellMove: () => ({ duration: 0 }),
  };
});

import ImportPage from '@/app/(main)/import/page';

const repoRoot = process.cwd();

function readRepoFile(file: string): string {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

afterEach(() => vi.unstubAllGlobals());

describe('import route boundary', () => {
  it('keeps upload and parser work out of the initial import route module', () => {
    const routeSource = readRepoFile('app/(main)/import/page.tsx');

    expect(routeSource).toContain("dynamic(() => import('@/components/import/ImportWorkspace')");
    expect(routeSource).toContain("Object.hasOwn(window, '__seriphPendingFontFiles')");
    expect(routeSource).not.toContain("from '@/components/ui/Dropzone'");
    expect(routeSource).not.toContain("from '@/lib/hooks/useResumableBatchUpload'");
    expect(routeSource).not.toContain("from '@/utils/pendingFonts'");
    expect(routeSource).not.toContain("from '@/utils/walkDirectoryEntries'");
  });

  it('contains the upload-only imports behind the interaction-bound workspace', () => {
    const workspaceSource = readRepoFile('components/import/ImportWorkspace.tsx');

    expect(workspaceSource).toContain("from '@/components/ui/Dropzone'");
    expect(workspaceSource).toContain("from '@/lib/hooks/useResumableBatchUpload'");
    expect(workspaceSource).toContain("from '@/utils/pendingFonts'");
    expect(workspaceSource).toContain("from '@/utils/walkDirectoryEntries'");
  });

  it('keeps the import frame rendered while the pending-file workspace chunk loads', () => {
    vi.stubGlobal('window', {
      __seriphPendingFontFiles: { uid: 'user-a', files: [] },
    });

    const markup = renderToStaticMarkup(createElement(ImportPage));

    expect(markup).toContain('min-h-[300px]');
    expect(markup).toContain('dashed-border');
    expect(markup).toContain('role="status"');
  });
});
