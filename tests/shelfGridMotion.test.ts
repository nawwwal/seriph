import { isValidElement, type ComponentProps, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShelfFamily } from '@/models/shelf.models';

const hookState = vi.hoisted(() => ({ index: 0, needsRerender: false, values: [] as unknown[] }));
const motionState = vi.hoisted(() => ({ reduced: false, MotionDiv: () => null }));

function isStateReducer(value: unknown): value is (current: unknown) => unknown { return typeof value === 'function'; }

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();

  return {
    ...actual,
    useState(initialState: unknown) {
      const index = hookState.index;
      hookState.index += 1;
      if (index === hookState.values.length) {
        hookState.values.push(isStateReducer(initialState) ? initialState(undefined) : initialState);
      }

      return [hookState.values[index], (nextState: unknown) => {
        hookState.values[index] = isStateReducer(nextState)
          ? nextState(hookState.values[index])
          : nextState;
        hookState.needsRerender = true;
      }];
    },
  };
});

vi.mock('framer-motion', () => ({ motion: { div: motionState.MotionDiv }, useReducedMotion: () => motionState.reduced }));

vi.mock('@/components/font/FamilyCover', () => ({ default: () => null }));

import ShelfFamilyGrid from '@/components/home/ShelfFamilyGrid';

function shelfFamily(id: string, updatedAt: string): ShelfFamily {
  return {
    id,
    name: `Family ${id}`,
    normalizedName: `family ${id}`,
    classification: 'Sans Serif', styleCount: 1, isVariable: false,
    updatedAt,
  };
}

function gridProps(families: ShelfFamily[]): ComponentProps<typeof ShelfFamilyGrid> {
  return {
    families,
    shelfMode: 'covers', coverSeed: 0, isRefreshing: false,
    selectionState: { mode: 'idle' },
    onOpenContextMenu: () => undefined,
  };
}

function renderGrid(props: ComponentProps<typeof ShelfFamilyGrid>) {
  let tree: ReactNode;

  do {
    hookState.index = 0;
    hookState.needsRerender = false;
    tree = ShelfFamilyGrid(props);
  } while (hookState.needsRerender);

  return tree;
}

function motionFamilyIds(tree: ReactNode): string[] {
  if (Array.isArray(tree)) {
    return tree.flatMap(motionFamilyIds);
  }
  if (!isValidElement<{ children?: ReactNode }>(tree)) {
    return [];
  }
  if (tree.type === motionState.MotionDiv) {
    const child = tree.props.children;
    if (isValidElement<{ family: { id: string } }>(child)) {
      return [child.props.family.id];
    }
  }
  return motionFamilyIds(tree.props.children);
}

afterEach(() => { hookState.index = 0; hookState.needsRerender = false; hookState.values = []; motionState.reduced = false; });

describe('ShelfFamilyGrid motion', () => {
  it('keeps a cached initial grid static, then animates appended and changed cards', () => {
    const first = shelfFamily('first', '2026-07-01T00:00:00.000Z');
    const appended = shelfFamily('appended', '2026-07-02T00:00:00.000Z');

    expect(motionFamilyIds(renderGrid(gridProps([first])))).toEqual([]);
    expect(motionFamilyIds(renderGrid(gridProps([first, appended])))).toEqual(['appended']);
    expect(
      motionFamilyIds(
        renderGrid(gridProps([shelfFamily('first', '2026-07-03T00:00:00.000Z'), appended]))
      )
    ).toEqual(['first']);
  });

  it('keeps appended and changed cards static when reduced motion is enabled', () => {
    motionState.reduced = true;
    const first = shelfFamily('first', '2026-07-01T00:00:00.000Z');
    const appended = shelfFamily('appended', '2026-07-02T00:00:00.000Z');

    renderGrid(gridProps([first]));
    expect(motionFamilyIds(renderGrid(gridProps([first, appended])))).toEqual([]);
    expect(
      motionFamilyIds(
        renderGrid(gridProps([shelfFamily('first', '2026-07-03T00:00:00.000Z'), appended]))
      )
    ).toEqual([]);
  });
});
