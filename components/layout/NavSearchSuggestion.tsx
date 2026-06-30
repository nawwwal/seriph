'use client';

import Link from 'next/link';
import { useRegisterShelfFace } from '@/components/font/FamilyCoverArt';
import { useFamilyRoutePrefetch } from '@/lib/hooks/useFamilyRoutePrefetch';
import type { SearchResultItem } from '@/models/search.models';
import type { ShelfFamily } from '@/models/shelf.models';

function toShelfFamily(item: SearchResultItem): ShelfFamily {
  return {
    id: item.slug || item.id,
    name: item.name,
    normalizedName: item.normalizedName || item.slug || item.id,
    classification: item.classification,
    styleCount: item.styleCount,
    isVariable: item.isVariable,
    updatedAt: item.updatedAt,
    coverFace: item.coverFace,
  };
}

export default function NavSearchSuggestion({
  item,
  onMouseDown,
}: {
  item: SearchResultItem;
  onMouseDown: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  const family = toShelfFamily(item);
  const familyId = item.slug || item.id;
  const prefetchFamily = useFamilyRoutePrefetch(familyId, true, family);
  useRegisterShelfFace(family, true);

  return (
    <Link
      href={`/family/${familyId}`}
      className="block px-3 py-2 text-sm hover:ink-bg transition-colors"
      onPointerEnter={prefetchFamily}
      onFocus={prefetchFamily}
      onTouchStart={prefetchFamily}
      onMouseDown={(event) => {
        prefetchFamily();
        onMouseDown(event);
      }}
    >
      <span className="block font-bold truncate" style={{ fontFamily: item.name }}>{item.name}</span>
      <span className="block text-[10px] uppercase opacity-60 truncate">
        {item.classification} · {item.styleCount} style{item.styleCount === 1 ? '' : 's'}
      </span>
    </Link>
  );
}
