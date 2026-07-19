import type { Classification } from '@/models/font.models';
import { mapStoredCoverFace } from '@/lib/api/familyShelfCover';
import { canonicalSearchClassification } from '@/lib/search/searchClassification';
import type { FamilyCursor, ShelfFamily } from '@/models/shelf.models';

const CATEGORY_TO_CLASS: Record<string, Classification> = {
  SANS_SERIF: 'Sans Serif',
  SERIF: 'Serif',
  DISPLAY: 'Display & Decorative',
  HANDWRITING: 'Script & Handwriting',
  MONOSPACE: 'Monospace',
};

function toIso(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  if (typeof (value as { seconds?: unknown }).seconds === 'number') {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString();
  }
  return '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeFace(face: unknown): Record<string, unknown> | null {
  return isObject(face) ? face : null;
}

export function mapCatalogDocToShelfFamily(data: Record<string, unknown>, id: string): ShelfFamily {
  const faces = Array.isArray(data.faces) ? data.faces.map(normalizeFace).filter((face) => face !== null) : [];
  const storedCoverFace = isObject(data.coverFace) ? data.coverFace : null;
  const category = typeof data.category === 'string' ? data.category : '';
  const enrichment = isObject(data.enrichment) ? data.enrichment : {};
  const styleCount = typeof data.styleCount === 'number' ? data.styleCount : faces.length;
  const isVariable = typeof data.isVariable === 'boolean'
    ? data.isVariable
    : (Array.isArray(data.axes) && data.axes.length > 0) || faces.some((face) => Boolean(face.isVariable));

  return {
    id: typeof data.slug === 'string' ? data.slug : id,
    name: typeof data.name === 'string' ? data.name : id,
    normalizedName: typeof data.slug === 'string' ? data.slug : id,
    classification: canonicalSearchClassification(enrichment.classification) ?? canonicalSearchClassification(data.classification) ?? CATEGORY_TO_CLASS[category] ?? 'Sans Serif',
    styleCount,
    isVariable,
    updatedAt: toIso(data.updatedAt),
    coverFace: mapStoredCoverFace(storedCoverFace),
  };
}

export function encodeFamilyCursor(cursor: FamilyCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeFamilyCursor(cursor: string | null | undefined): FamilyCursor | null {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!isObject(parsed)) return null;
    if (typeof parsed.sortValue !== 'string' || typeof parsed.id !== 'string') return null;
    return { sortValue: parsed.sortValue, id: parsed.id };
  } catch {
    return null;
  }
}
