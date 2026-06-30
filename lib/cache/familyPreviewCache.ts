'use client';

import type { Font, FontFamily, FontFormat } from '@/models/font.models';
import type { ShelfCoverFace, ShelfFamily } from '@/models/shelf.models';

const previewsById = new Map<string, FontFamily>();

function cacheKey(uid: string, familyId: string): string {
  return `${uid}:${familyId}`;
}

function formatFromUrl(url: string | undefined): FontFormat {
  const ext = url?.split('?')[0]?.split('.').pop()?.toUpperCase();
  return ext === 'WOFF' || ext === 'TTF' || ext === 'OTF' || ext === 'EOT' ? ext : 'WOFF2';
}

function styleFromFace(face: ShelfCoverFace): Font['style'] {
  return face.italic ? 'Italic' : 'Regular';
}

function fontFromFace(face: ShelfCoverFace): Font {
  return {
    id: face.id,
    filename: face.id,
    format: formatFromUrl(face.cdnUrl),
    subfamily: face.subfamily,
    weight: face.weight,
    style: styleFromFace(face),
    isVariable: face.isVariable,
    fileSize: 0,
    metadata: { cdnUrl: face.cdnUrl },
  };
}

export function previewFamilyFromShelf(family: ShelfFamily): FontFamily {
  return {
    id: family.id,
    name: family.name,
    normalizedName: family.normalizedName,
    description: '',
    tags: [],
    classification: family.classification,
    metadata: {},
    fonts: family.coverFace ? [fontFromFace(family.coverFace)] : [],
    uploadDate: family.updatedAt,
    lastModified: family.updatedAt,
  };
}

export function cacheFamilyPreview(uid: string, family: ShelfFamily): FontFamily {
  const preview = previewFamilyFromShelf(family);
  previewsById.set(cacheKey(uid, family.id), preview);
  if (family.normalizedName !== family.id) previewsById.set(cacheKey(uid, family.normalizedName), preview);
  return preview;
}

export function getCachedFamilyPreview(uid: string | undefined, familyId: string | undefined): FontFamily | undefined {
  return uid && familyId ? previewsById.get(cacheKey(uid, familyId)) : undefined;
}

export function clearFamilyPreviewCacheForUser(uid: string): void {
  for (const key of previewsById.keys()) {
    if (key.startsWith(`${uid}:`)) previewsById.delete(key);
  }
}
