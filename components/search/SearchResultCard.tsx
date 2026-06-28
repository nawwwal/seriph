import Link from 'next/link';
import type { SearchResultItem } from '@/lib/hooks/useFontSearch';

export default function SearchResultCard({ r }: { r: SearchResultItem }) {
  return (
    <Link href={`/family/${r.slug}`} className="block rule rounded-[var(--radius)] p-4 hover:ink-bg transition-colors">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold">{r.name}</span>
        <span className="text-xs uppercase opacity-60">{r.classification || r.category}</span>
      </div>
      {r.summary && <p className="mt-2 text-sm opacity-80 line-clamp-3">{r.summary}</p>}
      {r.moods && r.moods.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {r.moods.slice(0, 4).map((m) => (
            <span key={m} className="text-xs rule px-2 py-0.5 rounded-full opacity-70">{m}</span>
          ))}
        </div>
      )}
      <div className="mt-3 text-xs uppercase opacity-50">
        {r.styleCount} style{r.styleCount === 1 ? '' : 's'}
      </div>
    </Link>
  );
}
