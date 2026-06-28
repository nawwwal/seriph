import { FontFamily, Font, Classification, FontFormat } from '@/models/font.models';

/**
 * Adapts a rebuilt catalog document (faces[] + enrichment + CDN urls) into the
 * existing `FontFamily` shape the UI components consume — so the front-end design
 * and components stay unchanged while the back-end schema moves to the Google
 * Fonts model. CDN urls are surfaced on each font's metadata (`cdnUrl` for
 * rendering, `downloadUrl` for downloads).
 */

const CATEGORY_TO_CLASS: Record<string, Classification> = {
  SANS_SERIF: 'Sans Serif',
  SERIF: 'Serif',
  DISPLAY: 'Display & Decorative',
  HANDWRITING: 'Script & Handwriting',
  MONOSPACE: 'Monospace',
};

function toIso(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return '';
}

/** True if a Firestore doc uses the rebuilt catalog schema. */
export function isCatalogDoc(data: any): boolean {
  return Array.isArray(data?.faces);
}

export function mapCatalogDoc(data: any, id: string): FontFamily {
  const faces: any[] = Array.isArray(data.faces) ? data.faces : [];
  const fonts: Font[] = faces.map((f) => ({
    id: f.id,
    filename: f.filename || f.id,
    format: ((f.format || 'OTF') as string).toUpperCase() as FontFormat,
    subfamily: f.styleName || f.weightName || 'Regular',
    weight: typeof f.weight === 'number' ? f.weight : 400,
    style: (f.weightName || 'Regular') as Font['style'],
    isVariable: !!f.isVariable,
    variableAxes: Array.isArray(f.axes)
      ? f.axes.map((a: any) => ({
          tag: a.tag,
          name: a.name || a.tag,
          minValue: a.min,
          maxValue: a.max,
          defaultValue: a.default,
        }))
      : undefined,
    fileSize: typeof f.fileSize === 'number' ? f.fileSize : 0,
    metadata: {
      postScriptName: f.postScriptName,
      storagePath: null,
      cdnUrl: f.woff2?.url,
      downloadUrl: f.original?.url,
      characterSetCoverage: f.meta?.characterSetCoverage,
      openTypeFeatures: f.meta?.openTypeFeatures,
      glyphCount: f.meta?.glyphCount,
      languageSupport: f.meta?.languageSupport,
      version: f.meta?.version,
      license: f.meta?.license,
    },
  }));

  const enr = data.enrichment || {};
  return {
    id: data.slug || id,
    name: data.name || id,
    normalizedName: data.slug || id,
    ownerId: data.ownerId,
    foundry: data.foundry,
    description: enr.summary || '',
    tags: Array.isArray(enr.moods) ? enr.moods.slice(0, 6) : [],
    classification: CATEGORY_TO_CLASS[data.category as string] || 'Sans Serif',
    metadata: {
      foundry: data.foundry,
      subClassification: enr.classification,
      moods: enr.moods,
      useCases: enr.useCases,
    },
    fonts,
    uploadDate: toIso(data.createdAt),
    lastModified: toIso(data.updatedAt),
  } as FontFamily;
}

/** Map any doc: catalog docs are adapted, legacy docs passed through. */
export function adaptFamilyDoc(data: any, id: string): FontFamily {
  if (isCatalogDoc(data)) return mapCatalogDoc(data, id);
  return { ...(data as FontFamily), id: (data as any).id ?? id };
}
