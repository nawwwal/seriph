import type { Classification, FontFamily } from '@/models/font.models';
import type { FamilyEnrichment } from '@/models/font-family.models';
import { mapCatalogFaces } from '@/lib/db/catalogFaceAdapter';
import { asRecord, number, text, textArray, toIso, type CatalogRecord } from '@/lib/db/catalogValues';

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

function populatedText(record: CatalogRecord, key: string): string | undefined {
  const value = text(record, key);
  return value?.trim() ? value : undefined;
}

function populatedTextArray(value: unknown): string[] | undefined {
  const values = textArray(value)?.filter((item) => item.trim());
  return values?.length ? values : undefined;
}

function normalizedDateTime(value: unknown): string | undefined {
  const date = toIso(value);
  if (!date || Number.isNaN(Date.parse(date))) return undefined;
  return new Date(date).toISOString();
}

function mapEnrichment(data: unknown): FamilyEnrichment {
  const record = asRecord(data) ?? {};
  const confidence = number(record, 'confidence', Number.NaN);
  const entries: FamilyEnrichment = {
    classification: populatedText(record, 'classification'), summary: populatedText(record, 'summary'),
    moods: populatedTextArray(record.moods), voice: populatedText(record, 'voice'),
    useCases: populatedTextArray(record.useCases), pairingHints: populatedTextArray(record.pairingHints),
    confidence: Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : undefined,
    enrichedAt: normalizedDateTime(record.enrichedAt),
  };
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined));
}

export function mapCatalogDoc(data: CatalogRecord, id: string): FontFamily {
  const fonts = mapCatalogFaces(Array.isArray(data.faces) ? data.faces : []);
  const enrichmentRecord = asRecord(data.enrichment) ?? {};
  const enrichment = mapEnrichment(enrichmentRecord);
  const category = text(data, 'category') ?? '';
  const slug = text(data, 'slug') ?? id;
  const moods = enrichment.moods ?? [];
  const useCases = enrichment.useCases ?? [];
  const pairingHints = enrichment.pairingHints ?? [];
  const voice = enrichment.voice;
  return {
    id: slug,
    name: text(data, 'name') ?? id,
    normalizedName: slug,
    ownerId: text(data, 'ownerId'),
    foundry: text(data, 'foundry'),
    description: enrichment.summary ?? '',
    tags: [...moods, ...useCases].slice(0, 10),
    classification: CATEGORY_TO_CLASS[category] || 'Sans Serif',
    metadata: {
      foundry: text(data, 'foundry') ?? text(data, 'designer'),
      subClassification: enrichment.classification,
      moods: moods.length ? moods : undefined,
      useCases: useCases.length ? useCases : undefined,
      similarFamilies: pairingHints.length ? pairingHints : undefined,
      technicalCharacteristics: voice ? [voice] : undefined,
      enrichment,
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
