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
          className="shelf-card-skeleton relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-[var(--radius)] rule"
        >
          <div className="relative flex flex-1 items-end bg-[color-mix(in_srgb,var(--ink)_6%,var(--paper))] p-4 sm:p-5 md:p-6">
            <span className="text-6xl font-black uppercase leading-none opacity-10 pulse sm:text-7xl lg:text-6xl xl:text-7xl">
              ABC
            </span>
          </div>
          <div className="bg-[var(--paper)] p-3 rule-t sm:p-4">
            <div className="h-5 w-1/2 bg-[color-mix(in_srgb,var(--ink)_12%,transparent)] pulse" />
            <div className="mt-4 flex items-center justify-between">
              <div className="h-3 w-16 bg-[color-mix(in_srgb,var(--ink)_12%,transparent)] pulse" />
              <div className="h-3 w-24 bg-[color-mix(in_srgb,var(--ink)_12%,transparent)] pulse" />
            </div>
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
