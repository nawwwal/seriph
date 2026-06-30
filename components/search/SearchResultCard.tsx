import FamilyCover from '@/components/font/FamilyCover';
import type { SearchResultItem } from '@/models/search.models';
import type { ShelfFamily } from '@/models/shelf.models';

export default function SearchResultCard({ r }: { r: SearchResultItem }) {
  const family: ShelfFamily = {
    id: r.slug || r.id,
    name: r.name,
    normalizedName: r.normalizedName || r.slug || r.id,
    classification: r.classification,
    styleCount: r.styleCount,
    isVariable: r.isVariable,
    updatedAt: r.updatedAt,
    coverFace: r.coverFace,
  };
  return <FamilyCover family={family} mode="covers" description={r.summary} />;
}
