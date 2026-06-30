import { SHELF_GRID_CLASS } from './shelfGrid';

const INITIAL_SKELETON_COUNT = 12;

interface ShelfCardSkeletonGridProps {
  count?: number;
}

export function ShelfCardSkeletonGrid({ count = INITIAL_SKELETON_COUNT }: ShelfCardSkeletonGridProps) {
  return (
    <div className={SHELF_GRID_CLASS} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="shelf-card-skeleton relative h-full min-h-[220px] rule rounded-[var(--radius)] overflow-hidden flex flex-col">
          <div className="relative flex-1 flex items-end p-4 sm:p-5 md:p-6 bg-[color-mix(in_srgb,var(--ink)_6%,var(--paper))] pulse">
            <div className="absolute inset-0 cover-stripe" />
            <div className="relative z-10 h-16 w-28 bg-[color-mix(in_srgb,var(--ink)_18%,transparent)] rounded-[var(--radius)]" />
          </div>
          <div className="rule-t p-3 sm:p-4 bg-[var(--paper)]">
            <div className="h-5 w-4/5 bg-[color-mix(in_srgb,var(--ink)_16%,transparent)] rounded-[var(--radius)] pulse" />
            <div className="mt-3 flex justify-between items-center">
              <div className="h-3 w-20 bg-[color-mix(in_srgb,var(--ink)_16%,transparent)] rounded-[var(--radius)] pulse" />
              <div className="h-3 w-24 bg-[color-mix(in_srgb,var(--ink)_16%,transparent)] rounded-[var(--radius)] pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ShelfSkeleton() {
  return (
    <main className="mt-6 sm:mt-8 md:mt-10">
      <ShelfCardSkeletonGrid />
    </main>
  );
}
