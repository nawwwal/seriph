export function canonicalFamilyDocId(uid: string, slug: string): string {
  return `${uid}__${slug}`;
}
