'use client';

import FamilyCover from '@/components/font/FamilyCover';
import { useMemo } from 'react';
import { useFamilyRoutePrefetch } from '@/lib/hooks/useFamilyRoutePrefetch';
import type { FamilyDetailPreviewInput } from '@/lib/cache/familyDetailPreview';
import type { SearchResultItem } from '@/models/search.models';
import type { ShelfFamily } from '@/models/shelf.models';

export default function SearchResultCard({ r }: { r: SearchResultItem }) {
  const familyId = r.slug || r.id;
  const preview = useMemo<FamilyDetailPreviewInput>(() => ({ kind: 'search', item: r }), [r]);
  useFamilyRoutePrefetch(familyId, true, preview);
  const family: ShelfFamily = {
    id: familyId,
    name: r.name,
    normalizedName: r.normalizedName || r.slug || r.id,
    classification: r.classification,
    styleCount: r.styleCount,
    isVariable: r.isVariable,
    updatedAt: r.updatedAt,
    coverFace: r.coverFace,
  };
  return <FamilyCover family={family} mode="covers" />;
}
