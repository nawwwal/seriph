import type { Font, FontFormat, VariableAxis } from '@/models/font.models';
import { asRecord, number, text, textArray } from '@/lib/db/catalogValues';

const FORMATS = new Set<FontFormat>(['TTF', 'OTF', 'WOFF', 'WOFF2', 'EOT']);

function faceUrl(face: Record<string, unknown>, key: string): string | undefined {
  const asset = asRecord(face[key]);
  return typeof asset?.url === 'string' ? asset.url : undefined;
}

function publicAssetUrl(value: unknown): { url: string } | undefined {
  const asset = asRecord(value);
  return asset && typeof asset.url === 'string' ? { url: asset.url } : undefined;
}

function faceAssets(value: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const assets = value.map((entry) => {
    const item = asRecord(entry);
    const original = publicAssetUrl(item?.original);
    const id = item ? text(item, 'id') : undefined;
    if (!item || !id || !original) return null;
    return {
      id, contentHash: text(item, 'contentHash'), containerFormat: fontFormat(item.containerFormat),
      technology: text(item, 'technology'), parsedVersion: text(item, 'parsedVersion'),
      originalName: text(item, 'originalName'), original, served: publicAssetUrl(item.served),
    };
  }).filter((item) => item !== null) as Record<string, unknown>[];
  return assets.length ? assets : undefined;
}

function fontFormat(value: unknown): FontFormat {
  const format = typeof value === 'string' ? value.toUpperCase() : 'OTF';
  return FORMATS.has(format as FontFormat) ? format as FontFormat : 'OTF';
}

function axis(value: unknown): VariableAxis | null {
  const item = asRecord(value);
  const tag = item ? text(item, 'tag') : undefined;
  if (!item || !tag) return null;
  return {
    tag,
    name: text(item, 'name') ?? tag,
    minValue: number(item, 'min'),
    maxValue: number(item, 'max'),
    defaultValue: number(item, 'default'),
  };
}

function mapFace(value: unknown, index: number): Font | null {
  const face = asRecord(value);
  if (!face) return null;
  const id = text(face, 'id') ?? `face-${index + 1}`;
  const meta = asRecord(face.meta) ?? {};
  const assets = faceAssets(face.assets);
  const weightName = text(face, 'weightName') ?? 'Regular';
  return {
    id,
    filename: text(face, 'filename') ?? id,
    format: fontFormat(face.format),
    subfamily: text(face, 'styleName') ?? weightName,
    weight: number(face, 'weight', 400),
    style: weightName as Font['style'],
    isVariable: Boolean(face.isVariable),
    variableAxes: Array.isArray(face.axes)
      ? face.axes.map(axis).filter((item): item is VariableAxis => item !== null)
      : undefined,
    fileSize: number(face, 'fileSize'),
    metadata: {
      postScriptName: text(face, 'postScriptName'),
      storagePath: null,
      cdnUrl: faceUrl(face, 'woff2'),
      downloadUrl: faceUrl(face, 'original'),
      characterSetCoverage: textArray(meta.characterSetCoverage),
      openTypeFeatures: textArray(meta.openTypeFeatures),
      glyphCount: number(meta, 'glyphCount') || undefined,
      languageSupport: textArray(meta.languageSupport),
      version: text(meta, 'version'),
      license: text(meta, 'license'),
      ...(assets ? { assets, preferredAssetId: text(face, 'preferredAssetId') } : {}),
    },
  };
}

export function mapCatalogFaces(faces: unknown[]): Font[] {
  return faces.map(mapFace).filter((face): face is Font => face !== null);
}
