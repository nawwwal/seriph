'use client';

export default function FontDetailLoader() {
  return (
    <div className="w-screen h-screen flex flex-col bg-[var(--paper)]">
      {/* Skeleton NavBar */}
      <nav className="w-full rule-b bg-[var(--paper)] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex gap-2 items-center">
          <div className="h-8 w-20 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
          <div className="h-8 w-24 rule rounded-[var(--radius)] bg-[var(--muted)] pulse ml-2"></div>
          <div className="ml-auto h-8 w-32 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
        </div>
      </nav>

      <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        {/* Header Skeleton */}
        <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              {/* Font Family Name Skeleton */}
              <div className="h-20 sm:h-24 md:h-28 w-64 sm:w-80 md:w-96 bg-[var(--muted)] rounded-[var(--radius)] pulse relative overflow-hidden">
                <div className="cover-stripe absolute inset-0"></div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="h-10 w-32 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
              <div className="h-10 w-32 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
            </div>
          </div>
          {/* Description Skeleton */}
          <div className="mt-3 sm:mt-4 max-w-3xl space-y-2">
            <div className="h-5 bg-[var(--muted)] rounded-[var(--radius)] pulse w-full"></div>
            <div className="h-5 bg-[var(--muted)] rounded-[var(--radius)] pulse w-4/5"></div>
          </div>
        </header>

        {/* Specimen Skeleton */}
        <section className="mt-8 mb-6">
          <div
            className="specimen-container rule p-6 rounded-[var(--radius)] overflow-hidden relative min-h-[300px] flex items-center justify-center"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--ink) 10%, transparent), transparent 60%)',
            }}
          >
            <div className="cover-stripe absolute inset-0"></div>
            <div className="relative z-10 text-center">
              <div className="uppercase font-black text-sm sm:text-base tracking-tight mb-4 opacity-70">
                Loading Type Specimen
              </div>
              <div className="flex items-center justify-center gap-2">
                <div
                  className="w-3 h-3 rounded-full bg-[var(--ink)]"
                  style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
                ></div>
                <div
                  className="w-3 h-3 rounded-full bg-[var(--ink)]"
                  style={{ animation: 'pulse 1.5s ease-in-out 0.2s infinite' }}
                ></div>
                <div
                  className="w-3 h-3 rounded-full bg-[var(--ink)]"
                  style={{ animation: 'pulse 1.5s ease-in-out 0.4s infinite' }}
                ></div>
              </div>
              <div className="mt-6 uppercase text-xs font-bold tracking-wide opacity-60">
                Analyzing font metrics & glyphs
              </div>
            </div>
          </div>
        </section>

        {/* Styles Section Skeleton */}
        <section className="mt-6">
          <div className="flex justify-between items-center rule-b pb-4">
            <div className="h-8 w-32 bg-[var(--muted)] rounded-[var(--radius)] pulse"></div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-7 w-16 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"
                ></div>
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

        {/* Type Tester Skeleton */}
        <section className="mt-10">
          <div className="h-8 w-40 bg-[var(--muted)] rounded-[var(--radius)] pulse rule-b pb-4"></div>
          <div className="mt-6 rule p-6 rounded-[var(--radius)]">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
              <div className="flex gap-3 flex-wrap">
                <div className="h-10 w-32 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
                <div className="h-10 w-24 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-7 w-16 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
                <div className="h-7 w-16 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
              </div>
            </div>
            <div className="h-24 bg-[var(--muted)] rounded-[var(--radius)] pulse"></div>
          </div>
        </section>

        {/* Footer Skeleton */}
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
      </div>
    </div>
  );
}

