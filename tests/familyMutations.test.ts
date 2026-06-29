import { describe, expect, it } from 'vitest';
import {
  buildFamilyHardDeletePlan,
  buildFamilyMergePlan,
} from '@/lib/server/familyMutations';
import { face, family } from './familyMutationFixtures';

const now = new Date('2026-06-30T10:00:00.000Z');

describe('family mutation planning', () => {
  it('merges owned visible families into a ready target, hides sources, and preserves undo snapshots', () => {
    const result = buildFamilyMergePlan({
      uid: 'user-1',
      mergeId: 'merge-1',
      familyIds: ['target-family', 'source-family', 'duplicate-family'],
      targetFamilyId: 'target-family',
      now,
      families: [
        family('target-family', { faces: [face('regular', 'hash-a', 'target-family')] }),
        family('source-family', { faces: [face('regular', 'hash-b', 'source-family'), face('bold', 'hash-c', 'source-family')] }),
        family('duplicate-family', { faces: [face('regular', 'hash-a', 'duplicate-family')] }),
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value.targetFamilyId).toBe('target-family');
    expect(result.value.targetDoc.status).toBe('ready');
    expect(result.value.targetDoc.faces?.map((item) => item.id)).toEqual(['regular', 'regular-source-family', 'bold']);
    expect(result.value.targetDoc.manualMerge).toMatchObject({
      displayNamePending: true,
      selectedFamilyIds: ['target-family', 'source-family', 'duplicate-family'],
    });
    expect(result.value.deletedFieldNames).toEqual(['enrichment', 'searchText', 'searchTokens', 'searchMeta', 'text_vec', 'mood_vec', 'use_case_vec', 'image_vec']);
    expect(result.value.aliasDocs.map((item) => [item.familyId, item.doc.mergedInto, item.doc.hidden])).toEqual([
      ['source-family', 'target-family', true],
      ['duplicate-family', 'target-family', true],
    ]);
    expect(result.value.operation.snapshots.map((item) => item.familyId)).toEqual(['target-family', 'source-family', 'duplicate-family']);
    expect(result.value.undoExpiresAt).toBe('2026-06-30T10:05:00.000Z');
  });

  it('rejects non-owned and already-merged families before planning writes', () => {
    const wrongOwner = buildFamilyMergePlan({
      uid: 'user-1',
      mergeId: 'merge-1',
      familyIds: ['target-family', 'other-family'],
      targetFamilyId: 'target-family',
      now,
      families: [family('target-family'), family('other-family', { ownerId: 'user-2' })],
    });
    const alias = buildFamilyMergePlan({
      uid: 'user-1',
      mergeId: 'merge-1',
      familyIds: ['target-family', 'alias-family'],
      targetFamilyId: 'target-family',
      now,
      families: [family('target-family'), family('alias-family', { status: 'merged', hidden: true, mergedInto: 'target-family' })],
    });

    expect(wrongOwner).toEqual({ ok: false, code: 'forbidden', message: 'Family other-family is not owned by the current user.' });
    expect(alias).toEqual({ ok: false, code: 'bad_request', message: 'Family alias-family is not a visible family.' });
  });

  it('builds a hard-delete plan for selected families, related aliases, and referenced assets', () => {
    const result = buildFamilyHardDeletePlan({
      uid: 'user-1',
      familyIds: ['target-family'],
      selectedFamilies: [family('target-family', { faces: [face('regular', 'hash-a', 'target-family')] })],
      aliasFamilies: [family('source-family', { status: 'merged', hidden: true, mergedInto: 'target-family', faces: [face('bold', 'hash-b', 'source-family')] })],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value.docIds.sort()).toEqual(['source-family', 'target-family']);
    expect(result.value.storagePaths.sort()).toEqual([
      'd/source-family/bold.otf',
      'd/target-family/regular.otf',
      's/source-family/bold.woff2',
      's/target-family/regular.woff2',
    ]);
  });
});
