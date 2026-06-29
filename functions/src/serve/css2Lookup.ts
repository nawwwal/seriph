import { type Firestore } from 'firebase-admin/firestore';
import { FAMILIES_COLLECTION } from '../storage/familyStore';
import type { FontFamilyDoc } from '../models/catalog.models';

function toFamilyDoc(id: string, data: FirebaseFirestore.DocumentData | undefined): FontFamilyDoc | null {
  return data ? ({ ...data, id, slug: data.slug ?? id } as FontFamilyDoc) : null;
}

async function findVisibleFamilyBySlug(db: Firestore, slug: string): Promise<FontFamilyDoc | null> {
  const direct = await db.collection(FAMILIES_COLLECTION).doc(slug).get();
  const directFamily = toFamilyDoc(direct.id, direct.data());
  if (direct.exists && directFamily) return directFamily;
  const snap = await db.collection(FAMILIES_COLLECTION).where('slug', '==', slug).limit(1).get();
  const doc = snap.docs[0];
  return doc ? toFamilyDoc(doc.id, doc.data()) : null;
}

export async function loadCssFamiliesBySlug(db: Firestore, slugs: string[]): Promise<Map<string, FontFamilyDoc>> {
  const bySlug = new Map<string, FontFamilyDoc>();
  const aliases: Array<{ sourceSlug: string; targetSlug: string }> = [];
  for (const slug of slugs) {
    const family = await findVisibleFamilyBySlug(db, slug);
    if (!family) continue;
    const targetSlug = family.mergedInto ?? family.aliasOf;
    if (targetSlug) aliases.push({ sourceSlug: slug, targetSlug });
    else if (family.status !== 'merged' && family.hidden !== true) bySlug.set(slug, family);
  }

  const missingTargets = [...new Set(aliases.map((alias) => alias.targetSlug).filter((slug) => !bySlug.has(slug)))];
  for (const targetSlug of missingTargets) {
    const family = await findVisibleFamilyBySlug(db, targetSlug);
    if (family) bySlug.set(targetSlug, family);
  }
  for (const alias of aliases) {
    const target = bySlug.get(alias.targetSlug);
    if (target) bySlug.set(alias.sourceSlug, target);
  }
  return bySlug;
}
