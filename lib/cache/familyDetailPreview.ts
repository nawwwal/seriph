import type { Font, FontFamily, FontFormat } from '@/models/font.models';
import type { SearchResultItem } from '@/models/search.models';
import type { ShelfCoverFace, ShelfFamily } from '@/models/shelf.models';

export type FamilyDetailPreviewInput =
  | { kind: 'shelf'; family: ShelfFamily }
  | { kind: 'search'; item: SearchResultItem };

function formatFromUrl(url: string | undefined): FontFormat {
  const ext = url?.split('?')[0]?.split('.').pop()?.toUpperCase();
  return ext === 'WOFF' || ext === 'TTF' || ext === 'OTF' || ext === 'EOT' ? ext : 'WOFF2';
}

function fontFromFace(face: ShelfCoverFace): Font {
  return {
    id: face.id,
    filename: face.id,
    format: formatFromUrl(face.cdnUrl),
    subfamily: face.subfamily,
    weight: face.weight,
    style: face.italic ? 'Italic' : 'Regular',
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

export function familyDetailPreviewFromSearch(item: SearchResultItem): FontFamily {
  const id = item.slug || item.id;
  const moods = [...(item.moods ?? [])];
  const useCases = [...(item.useCases ?? [])];
  const family = previewFamilyFromShelf({
    id,
    name: item.name,
    normalizedName: item.normalizedName || id,
    classification: item.classification,
    styleCount: item.styleCount,
    isVariable: item.isVariable,
    updatedAt: item.updatedAt,
    coverFace: item.coverFace,
  });
  return {
    ...family,
    description: item.summary ?? '',
    tags: moods,
    metadata: {
      moods,
      useCases,
      enrichment: {
        classification: item.category || item.classification,
        summary: item.summary,
        moods,
        useCases,
      },
    },
  };
}

export function familyDetailPreview(input: FamilyDetailPreviewInput): FontFamily {
  switch (input.kind) {
    case 'shelf': return previewFamilyFromShelf(input.family);
    case 'search': return familyDetailPreviewFromSearch(input.item);
    default: {
      const exhaustive: never = input;
      return exhaustive;
    }
  }
}
