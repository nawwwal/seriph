import type { Font, FontFormat, VariableAxis } from '@/models/font.models';
import { asRecord, number, text, textArray } from '@/lib/db/catalogValues';

const FORMATS = new Set<FontFormat>(['TTF', 'OTF', 'WOFF', 'WOFF2', 'EOT']);

function faceUrl(face: Record<string, unknown>, key: string): string | undefined {
  const asset = asRecord(face[key]);
  return typeof asset?.url === 'string' ? asset.url : undefined;
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
    },
  };
}

export function mapCatalogFaces(faces: unknown[]): Font[] {
  return faces.map(mapFace).filter((face): face is Font => face !== null);
}
