import type { DocumentData, Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { FontFamilyDoc } from "../../models/catalog.models";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import { isAliasFamily, isSearchableStatus } from "../../search/searchFilters";
import { tokenizeSearchText } from "../../search/searchDocument";

function asFamily(doc: QueryDocumentSnapshot): FontFamilyDoc {
  return { ...doc.data(), id: doc.id } as FontFamilyDoc;
}

function keep(family: FontFamilyDoc, source: FontFamilyDoc): boolean {
  return family.id !== source.id && family.slug !== source.slug && isSearchableStatus(family) && !isAliasFamily(family);
}

function nameTokens(family: FontFamilyDoc): string[] {
  return tokenizeSearchText([family.name]).filter((token) => token.length >= 3 && !/^\d+$/.test(token)).slice(0, 10);
}

function slugStem(slug: string): string {
  return (slug.split("-").find((part) => part.length >= 3 && !/^\d+$/.test(part)) ?? "").slice(0, 24);
}

async function byTokens(db: Firestore, ownerId: string, tokens: string[]): Promise<QueryDocumentSnapshot[]> {
  if (!tokens.length) return [];
  const snap = await db.collection(FAMILIES_COLLECTION)
    .where("ownerId", "==", ownerId)
    .where("searchTokens", "array-contains-any", tokens)
    .limit(20)
    .get();
  return snap.docs;
}

async function bySlugStem(db: Firestore, ownerId: string, stem: string): Promise<QueryDocumentSnapshot[]> {
  if (stem.length < 3) return [];
  const snap = await db.collection(FAMILIES_COLLECTION)
    .where("slug", ">=", stem)
    .where("slug", "<", `${stem}\uf8ff`)
    .limit(20)
    .get();
  return snap.docs.filter((doc) => doc.get("ownerId") === ownerId);
}

export async function ownerFamilyNeighbors(db: Firestore, family: FontFamilyDoc, limit: number): Promise<FontFamilyDoc[]> {
  if (!family.ownerId) return [];
  const seen = new Set<string>();
  const out: FontFamilyDoc[] = [];
  const docs = [
    ...await byTokens(db, family.ownerId, nameTokens(family)),
    ...await bySlugStem(db, family.ownerId, slugStem(family.slug)),
  ];
  for (const doc of docs) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const candidate = asFamily(doc);
    if (!keep(candidate, family)) continue;
    out.push(candidate);
    if (out.length >= limit) break;
  }
  return out;
}

export function compactNeighbor(id: string, data: DocumentData): { id: string; slug: string; name: string; summary?: string } | null {
  if (isAliasFamily(data as FontFamilyDoc) || !data.slug || !data.name) return null;
  return { id, slug: data.slug, name: data.name, summary: data.enrichment?.summary };
}
