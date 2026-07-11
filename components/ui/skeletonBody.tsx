/** Loading skeletons: styles, type tester, and footer (lower font detail page). */

export function SkeletonStyles() {
  return (
    <section className="mt-6">
      <div className="flex justify-between items-center rule-b pb-4">
        <div className="h-8 w-32 bg-[var(--muted)] rounded-[var(--radius)] pulse"></div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 w-16 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
          ))}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rule rounded-[var(--radius)] overflow-hidden slide-in">
            <div className="p-4 pb-2">
              <div className="h-4 w-20 bg-[var(--muted)] rounded-[var(--radius)] pulse mb-2"></div>
              <div className="h-3 w-16 bg-[var(--muted)] rounded-[var(--radius)] pulse"></div>
            </div>
            <div className="px-4 pb-4">
              <div className="h-12 bg-[var(--muted)] rounded-[var(--radius)] pulse mb-2"></div>
              <div className="h-6 bg-[var(--muted)] rounded-[var(--radius)] pulse"></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Controls-only skeleton; specimen loads via SkeletonSpecimen above. */
export function SkeletonTester() {
  return (
    <section className="mt-6">
      <div className="rounded-[var(--radius)] rule p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 w-16 rounded-[var(--radius)] rule bg-[var(--muted)] pulse" />
            ))}
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-16 rounded-[var(--radius)] rule bg-[var(--muted)] pulse" />
            <div className="h-7 w-20 rounded-[var(--radius)] rule bg-[var(--muted)] pulse" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 rounded-[var(--radius)] bg-[var(--muted)] pulse" />
              <div className="h-3 w-full rounded-[var(--radius)] bg-[var(--muted)] pulse" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SkeletonFooter() {
  return (
    <footer className="mt-10 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rule-r pr-4 space-y-2">
          <div className="h-5 w-24 bg-[var(--muted)] rounded-[var(--radius)] pulse"></div>
          <div className="h-4 bg-[var(--muted)] rounded-[var(--radius)] pulse w-full"></div>
          <div className="h-4 bg-[var(--muted)] rounded-[var(--radius)] pulse w-4/5"></div>
        </div>
        <div className="rule-r pr-4 space-y-2">
          <div className="h-5 w-24 bg-[var(--muted)] rounded-[var(--radius)] pulse"></div>
          <div className="h-4 bg-[var(--muted)] rounded-[var(--radius)] pulse w-full"></div>
          <div className="h-4 bg-[var(--muted)] rounded-[var(--radius)] pulse w-3/4"></div>
        </div>
        <div className="space-y-2">
          <div className="h-5 w-24 bg-[var(--muted)] rounded-[var(--radius)] pulse"></div>
          <div className="flex gap-2">
            <div className="h-10 w-24 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
            <div className="h-10 w-24 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
          </div>
        </div>
      </div>
    </footer>
  );
}
