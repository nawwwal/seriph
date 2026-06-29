export default function ShelfSkeleton() {
  return (
    <main className="mt-6 sm:mt-8 md:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 grid-poster-gap auto-rows-fr">
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="relative h-full min-h-[220px] rule rounded-[var(--radius)] overflow-hidden flex flex-col">
          <div className="relative flex-1 bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] pulse">
            <div className="absolute inset-0 cover-stripe"></div>
            <div className="absolute left-5 bottom-8 h-12 w-24 bg-[color-mix(in_srgb,var(--ink)_18%,transparent)] rounded-[var(--radius)]"></div>
          </div>
          <div className="rule-t p-3 sm:p-4">
            <div className="h-3 w-14 bg-[color-mix(in_srgb,var(--ink)_16%,transparent)] rounded-[var(--radius)] pulse"></div>
            <div className="mt-3 h-5 w-4/5 bg-[color-mix(in_srgb,var(--ink)_16%,transparent)] rounded-[var(--radius)] pulse"></div>
            <div className="mt-4 flex justify-between">
              <div className="h-3 w-16 bg-[color-mix(in_srgb,var(--ink)_16%,transparent)] rounded-[var(--radius)] pulse"></div>
              <div className="h-3 w-20 bg-[color-mix(in_srgb,var(--ink)_16%,transparent)] rounded-[var(--radius)] pulse"></div>
            </div>
          </div>
        </div>
      ))}
    </main>
  );
}
