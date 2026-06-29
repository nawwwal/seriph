import type { Classification, FontFamily } from '@/models/font.models';
import { mapCatalogFaces } from '@/lib/db/catalogFaceAdapter';
import { asRecord, text, textArray, toIso, type CatalogRecord } from '@/lib/db/catalogValues';

const CATEGORY_TO_CLASS: Record<string, Classification> = {
  SANS_SERIF: 'Sans Serif',
  SERIF: 'Serif',
  DISPLAY: 'Display & Decorative',
  HANDWRITING: 'Script & Handwriting',
  MONOSPACE: 'Monospace',
};
export function isCatalogDoc(data: unknown): data is CatalogRecord & { faces: unknown[] } {
  return Array.isArray(asRecord(data)?.faces);
}

export function mergedInto(data: unknown): string | null {
  const record = asRecord(data);
  const target = typeof record?.mergedInto === 'string' ? record.mergedInto : record?.aliasOf;
  return typeof target === 'string' && target.trim() ? target : null;
}

export function isCatalogAliasDoc(data: unknown): boolean {
  const record = asRecord(data);
  return record?.status === 'merged' || record?.hidden === true || mergedInto(record) !== null;
}

export function mapCatalogDoc(data: CatalogRecord, id: string): FontFamily {
  const fonts = mapCatalogFaces(Array.isArray(data.faces) ? data.faces : []);
  const enrichment = asRecord(data.enrichment) ?? {};
  const category = text(data, 'category') ?? '';
  const slug = text(data, 'slug') ?? id;
  const moods = textArray(enrichment.moods);
  return {
    id: slug,
    name: text(data, 'name') ?? id,
    normalizedName: slug,
    ownerId: text(data, 'ownerId'),
    foundry: text(data, 'foundry'),
    description: text(enrichment, 'summary') ?? '',
    tags: moods?.slice(0, 6) ?? [],
    classification: CATEGORY_TO_CLASS[category] || 'Sans Serif',
    metadata: {
      foundry: text(data, 'foundry'),
      subClassification: text(enrichment, 'classification'),
      moods,
      useCases: textArray(enrichment.useCases),
    },
    fonts,
    uploadDate: toIso(data.createdAt),
    lastModified: toIso(data.updatedAt),
  };
}

export function adaptFamilyDoc(data: unknown, id: string): FontFamily {
  if (isCatalogDoc(data)) return mapCatalogDoc(data, id);
  const legacy = (asRecord(data) ?? {}) as Partial<FontFamily>;
  return { ...legacy, id: typeof legacy.id === 'string' ? legacy.id : id } as FontFamily;
}
