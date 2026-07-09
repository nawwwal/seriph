import { isValidElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gridProps, shelfFamily, type ShelfGridProps } from './helpers/shelfGridMotionFixtures';

const hookState = vi.hoisted(() => ({ index: 0, needsRerender: false, values: [] as unknown[] }));
const motionState = vi.hoisted(() => ({ reduced: false }));

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

vi.mock('framer-motion', () => ({ useReducedMotion: () => motionState.reduced }));

vi.mock('@/components/font/FamilyCover', () => ({ default: () => null }));

import ShelfFamilyGrid from '@/components/home/ShelfFamilyGrid';

function renderGrid(props: ShelfGridProps) {
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
  if (!isValidElement<{ children?: ReactNode; className?: string; family?: { id: string } }>(tree)) {
    return [];
  }
  if (tree.props.className?.includes('shelf-card-enter') && tree.props.family) {
    return [tree.props.family.id];
  }
  return motionFamilyIds(tree.props.children);
}

function topLevelType(tree: ReactNode, familyId: string): unknown {
  if (!Array.isArray(tree)) return null;
  for (const node of tree) {
    if (isValidElement(node) && node.key === familyId) return node.type;
  }
  return null;
}

afterEach(() => { hookState.index = 0; hookState.needsRerender = false; hookState.values = []; motionState.reduced = false; });

describe('ShelfFamilyGrid motion', () => {
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

  it('animates a 48-card append after a cached 48-card initial page', () => {
    const firstPage = Array.from({ length: 48 }, (_, index) => (
      shelfFamily(`family-${index + 1}`, '2026-07-01T00:00:00.000Z')
    ));
    const secondPage = Array.from({ length: 48 }, (_, index) => (
      shelfFamily(`family-${index + 49}`, '2026-07-02T00:00:00.000Z')
    ));

    expect(motionFamilyIds(renderGrid(gridProps(firstPage)))).toEqual([]);
    expect(motionFamilyIds(renderGrid(gridProps([...firstPage, ...secondPage])))).toEqual(
      secondPage.map((family) => family.id)
    );
  });

  it('keeps the keyed card element type stable when its animation state changes', () => {
    const initial = shelfFamily('stable-family', '2026-07-01T00:00:00.000Z');
    const initialTree = renderGrid(gridProps([initial]));
    const initialType = topLevelType(initialTree, initial.id);

    const changed = shelfFamily(initial.id, '2026-07-02T00:00:00.000Z');
    const changedTree = renderGrid(gridProps([changed]));

    expect(topLevelType(changedTree, changed.id)).toBe(initialType);
    expect(motionFamilyIds(changedTree)).toEqual([changed.id]);
  });
});
