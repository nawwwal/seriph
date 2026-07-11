import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('shell Framer storyboard', () => {
  it('keeps single-tree stage, dials, and layout ids', () => {
    const board = read('lib/motion/catalogDetailStoryboard.ts');
    for (const t of ['Single route tree', 'TIMING', 'LAYOUT', 'DEPTH']) {
      expect(board).toContain(t);
    }
    const page = read('components/motion/WorkspacePageTransition.tsx');
    expect(page).toContain('LayoutGroup');
    expect(page).toContain('Single route tree');
    const body = read('components/motion/shellMotionSlots.tsx');
    expect(body).toContain('buildBodyDepthVariants');
    expect(body).toContain('Enter-only');
    const logo = read('components/brand/SeriphLogo.tsx');
    expect(logo).toContain('layoutId');
    const dials = read('components/motion/useShellTransitionDials.ts');
    expect(dials).toContain('useDialKit');
    const runtime = read('components/motion/ShellMotionRuntime.tsx');
    expect(runtime).toContain('DialRoot');
  });
});
