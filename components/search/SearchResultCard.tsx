'use client';

import { memo, useMemo } from 'react';
import FamilyCover from '@/components/font/FamilyCover';
import { useFamilyRoutePrefetch } from '@/lib/hooks/useFamilyRoutePrefetch';
import type { FamilyDetailPreviewInput } from '@/lib/cache/familyDetailPreview';
import type { SearchResultItem } from '@/models/search.models';
import type { ShelfFamily } from '@/models/shelf.models';

function SearchResultCard({ r }: { r: SearchResultItem }) {
  const familyId = r.slug || r.id;
  const preview = useMemo<FamilyDetailPreviewInput>(() => ({ kind: 'search', item: r }), [r]);
  useFamilyRoutePrefetch(familyId, true, preview);
  const family = useMemo<ShelfFamily>(() => ({
    id: familyId,
    name: r.name,
    normalizedName: r.normalizedName || r.slug || r.id,
    classification: r.classification,
    styleCount: r.styleCount,
    isVariable: r.isVariable,
    updatedAt: r.updatedAt,
    coverFace: r.coverFace,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [familyId, r.classification, r.coverFace, r.isVariable, r.name, r.normalizedName, r.styleCount, r.updatedAt]);
  const moods = (r.moods ?? []).slice(0, 3);
  const hasNote = Boolean(r.summary || moods.length > 0);

  return (
    <div className="flex h-full flex-col">
      <FamilyCover family={family} mode="covers" />
      {hasNote && (
        <div className="rule rule-t-0 rounded-b-[var(--radius)] bg-[var(--paper)] px-4 py-2.5 text-xs">
          {r.summary && <p className="line-clamp-2 opacity-75">{r.summary}</p>}
          {moods.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {moods.map((mood) => (
                <span key={mood} className="rule rounded-[var(--radius)] px-1.5 py-0.5 text-[9px] font-bold uppercase opacity-75">{mood}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(SearchResultCard);
