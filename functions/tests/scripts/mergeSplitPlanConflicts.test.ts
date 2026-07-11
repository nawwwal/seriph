import { describe, expect, it } from 'vitest';
import { conflictDocIds, conflictFreePlan } from '../../src/scripts/mergeSplitPlanConflicts';
import type { MergeTarget, SplitFamilyMergePlan } from '../../src/scripts/mergeSplitFamilies';

function target(slug: string, aliasDocIds: string[] = []): MergeTarget {
  return {
    docId: `owner-1__${slug}`,
    slug,
    name: slug,
    fileBase: slug,
    ownerId: 'owner-1',
    category: 'SANS_SERIF',
    sourceSlugs: [slug],
    aliases: aliasDocIds.map((docId) => docId.replace('owner-1__', '')),
    aliasDocIds,
    faces: [],
  };
}

describe('merge split conflict filtering', () => {
  it('removes conflicted targets and any targets that share their documents', () => {
    const plan: SplitFamilyMergePlan = {
      targets: [
        target('clean', ['owner-1__clean-light']),
        target('conflicted', ['owner-1__conflicted-bold']),
        target('shared-source', ['owner-1__conflicted-bold']),
      ],
      aliases: [
        { sourceDocId: 'owner-1__clean-light', sourceSlug: 'clean-light', targetDocId: 'owner-1__clean', targetSlug: 'clean' },
        { sourceDocId: 'owner-1__conflicted-bold', sourceSlug: 'conflicted-bold', targetDocId: 'owner-1__conflicted', targetSlug: 'conflicted' },
        { sourceDocId: 'owner-1__conflicted-bold', sourceSlug: 'conflicted-bold', targetDocId: 'owner-1__shared-source', targetSlug: 'shared-source' },
      ],
      conflicts: [{ targetSlug: 'conflicted', faceId: 'bold', sources: ['conflicted', 'conflicted-bold'] }],
    };

    expect([...conflictDocIds(plan)].sort()).toEqual(['owner-1__conflicted', 'owner-1__conflicted-bold']);
    expect(conflictFreePlan(plan)).toMatchObject({
      targets: [{ slug: 'clean' }],
      aliases: [{ sourceDocId: 'owner-1__clean-light', targetDocId: 'owner-1__clean' }],
      conflicts: [],
    });
  });

  it('keeps a conflict-free plan unchanged', () => {
    const plan: SplitFamilyMergePlan = {
      targets: [target('clean', ['owner-1__clean-light'])],
      aliases: [{ sourceDocId: 'owner-1__clean-light', sourceSlug: 'clean-light', targetDocId: 'owner-1__clean', targetSlug: 'clean' }],
      conflicts: [],
    };

    expect(conflictFreePlan(plan)).toBe(plan);
  });
});
