import { type Firestore } from 'firebase-admin/firestore';
import { FAMILIES_COLLECTION } from '../storage/familyStore';
import type { FontFamilyDoc } from '../models/catalog.models';

function toFamilyDoc(id: string, data: FirebaseFirestore.DocumentData | undefined): FontFamilyDoc | null {
  return data ? ({ ...data, id, slug: data.slug ?? id } as FontFamilyDoc) : null;
}

async function findVisibleFamilyBySlug(db: Firestore, slug: string): Promise<FontFamilyDoc | null> {
  const snap = await db.collection(FAMILIES_COLLECTION).where('slug', '==', slug).limit(10).get();
  const docs = snap.docs.map((doc) => toFamilyDoc(doc.id, doc.data())).filter((doc): doc is FontFamilyDoc => doc !== null);
  const visible = docs.find((doc) => doc.hidden !== true && doc.status !== 'merged' && !doc.mergedInto && !doc.aliasOf);
  if (visible) return visible;
  if (docs.length > 0) return docs[0]!;
  if (slug.includes('/')) return null;
  const direct = await db.collection(FAMILIES_COLLECTION).doc(slug).get();
  return direct.exists ? toFamilyDoc(direct.id, direct.data()) : null;
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

  for (const alias of aliases) {
    const visited = new Set<string>();
    let targetSlug: string | undefined = alias.targetSlug;
    let resolved: FontFamilyDoc | undefined;
    for (let depth = 0; targetSlug && depth < 6 && !visited.has(targetSlug); depth += 1) {
      visited.add(targetSlug);
      const cached = bySlug.get(targetSlug);
      const next: FontFamilyDoc | null = cached ?? (await findVisibleFamilyBySlug(db, targetSlug));
      if (!next) break;
      const hop: string | undefined = next.mergedInto ?? next.aliasOf;
      if (hop) { targetSlug = hop; continue; }
      if (next.status !== 'merged' && next.hidden !== true) resolved = next;
      break;
    }
    if (resolved) bySlug.set(alias.sourceSlug, resolved);
  }
  return bySlug;
}
