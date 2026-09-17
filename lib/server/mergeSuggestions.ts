import type { Firestore } from 'firebase-admin/firestore';

export const MERGE_SUGGESTIONS_COLLECTION = 'familyMergeSuggestions';

export interface FamilyMergeSuggestion {
  id: string;
  familyIds: string[];
  slugs: string[];
  names: string[];
  verdict: 'related' | 'same';
  score: number;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

export async function listMergeSuggestions(db: Firestore, ownerId: string): Promise<FamilyMergeSuggestion[]> {
  const snap = await db.collection(MERGE_SUGGESTIONS_COLLECTION).where('ownerId', '==', ownerId).limit(20).get();
  return snap.docs.flatMap((doc) => {
    const data = doc.data();
    const familyIds = strings(data.familyIds);
    const names = strings(data.names);
    const slugs = strings(data.slugs);
    const verdict = data.verdict === 'same' || data.verdict === 'related' ? data.verdict : null;
    if (familyIds.length < 2 || names.length < 2 || !verdict) return [];
    return [{
      id: doc.id,
      familyIds,
      slugs,
      names,
      verdict,
      score: typeof data.score === 'number' ? data.score : 0,
    }];
  });
}
