import { FieldValue, type Firestore } from 'firebase-admin/firestore';

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
    if (data.dismissed === true) return [];
    const familyIds = strings(data.familyIds);
    const names = strings(data.names);
    const slugs = strings(data.slugs);
    const verdict = data.verdict === 'same' ? 'same' : null;
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

export async function dismissMergeSuggestion(db: Firestore, ownerId: string, suggestionId: string): Promise<boolean> {
  const ref = db.collection(MERGE_SUGGESTIONS_COLLECTION).doc(suggestionId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.ownerId !== ownerId) return false;
  await ref.set({ dismissed: true, dismissedAt: FieldValue.serverTimestamp() }, { merge: true });
  return true;
}

export async function cleanupSuggestionsForFamilies(db: Firestore, ownerId: string, slugsOrIds: string[]): Promise<void> {
  const targets = new Set(slugsOrIds.filter(Boolean));
  if (!targets.size) return;
  const snap = await db.collection(MERGE_SUGGESTIONS_COLLECTION).where('ownerId', '==', ownerId).limit(40).get();
  const stale = snap.docs.filter((doc) => {
    const data = doc.data();
    const ids = [...strings(data.familyIds), ...strings(data.slugs)];
    return ids.some((value) => targets.has(value));
  });
  if (!stale.length) return;
  const batch = db.batch();
  stale.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}
