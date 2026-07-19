import type { ShelfCoverFace } from '@/models/shelf.models';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function mapStoredCoverFace(face: Record<string, unknown> | null): ShelfCoverFace | undefined {
  if (!face) return undefined;
  const woff2 = isObject(face.woff2) ? face.woff2 : null;
  return {
    id: typeof face.id === 'string' ? face.id : 'regular',
    subfamily:
      typeof face.subfamily === 'string'
        ? face.subfamily
        : typeof face.styleName === 'string'
          ? face.styleName
          : typeof face.weightName === 'string'
            ? face.weightName
            : 'Regular',
    weight: typeof face.weight === 'number' ? face.weight : 400,
    italic: Boolean(face.italic),
    isVariable: Boolean(face.isVariable),
    cdnUrl: typeof face.cdnUrl === 'string'
      ? face.cdnUrl
      : typeof woff2?.url === 'string'
        ? woff2.url
        : undefined,
  };
}
