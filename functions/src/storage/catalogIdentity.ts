export function legacyCatalogDocId(slug: string): string {
  return slug;
}

export function catalogFamilyDocId(ownerId: string | undefined, slug: string): string {
  const owner = ownerId?.trim();
  return owner ? `${owner}__${slug}` : legacyCatalogDocId(slug);
}

export function catalogFamilyDocIdFor(family: { id?: string; ownerId?: string; slug: string }): string {
  return family.id?.trim() || catalogFamilyDocId(family.ownerId, family.slug);
}
