import { SHELF_GRID_CLASS } from './shelfGrid';

const INITIAL_SKELETON_COUNT = 12;

interface ShelfCardSkeletonGridProps {
  count?: number;
}

export function ShelfCardSkeletons({ count = INITIAL_SKELETON_COUNT }: ShelfCardSkeletonGridProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="shelf-card-skeleton relative flex min-h-[260px] flex-col overflow-hidden rounded-[var(--radius)] rule bg-[var(--paper)] p-5 sm:p-6"
        >
          <div>
            <div className="h-4 w-2/5 bg-[color-mix(in_srgb,var(--ink)_12%,transparent)] pulse" />
            <div className="mt-2 h-3 w-3/5 bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] pulse" />
          </div>
          <div className="mt-auto pt-8">
            <div className="text-6xl font-normal leading-none opacity-10 pulse sm:text-7xl">Aa</div>
            <div className="mt-6 h-5 w-4/5 bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] pulse" />
            <div className="mt-2 h-5 w-3/4 bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] pulse" />
          </div>
        </div>
      ))}
    </>
  );
}

export function ShelfCardSkeletonGrid({ count = INITIAL_SKELETON_COUNT }: ShelfCardSkeletonGridProps) {
  return (
    <div className={SHELF_GRID_CLASS} aria-hidden="true">
      <ShelfCardSkeletons count={count} />
    </div>
  );
}

export default function ShelfSkeleton() {
  return (
    <main>
      <ShelfCardSkeletonGrid />
    </main>
  );
}
