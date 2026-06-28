/** Loading skeletons: nav, header, and specimen (top of the font detail page). */

export function SkeletonNav() {
  return (
    <nav className="w-full rule-b bg-[var(--paper)] sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex gap-2 items-center">
        <div className="h-8 w-20 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
        <div className="h-8 w-24 rule rounded-[var(--radius)] bg-[var(--muted)] pulse ml-2"></div>
        <div className="ml-auto h-8 w-32 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
      </div>
    </nav>
  );
}

export function SkeletonHeader() {
  return (
    <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="h-20 sm:h-24 md:h-28 w-64 sm:w-80 md:w-96 bg-[var(--muted)] rounded-[var(--radius)] pulse relative overflow-hidden">
          <div className="cover-stripe absolute inset-0"></div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="h-10 w-32 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
          <div className="h-10 w-32 rule rounded-[var(--radius)] bg-[var(--muted)] pulse"></div>
        </div>
      </div>
      <div className="mt-3 sm:mt-4 max-w-3xl space-y-2">
        <div className="h-5 bg-[var(--muted)] rounded-[var(--radius)] pulse w-full"></div>
        <div className="h-5 bg-[var(--muted)] rounded-[var(--radius)] pulse w-4/5"></div>
      </div>
    </header>
  );
}

export function SkeletonSpecimen() {
  return (
    <section className="mt-8 mb-6">
      <div
        className="specimen-container rule p-6 rounded-[var(--radius)] overflow-hidden relative min-h-[300px] flex items-center justify-center"
        style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--ink) 10%, transparent), transparent 60%)' }}
      >
        <div className="cover-stripe absolute inset-0"></div>
        <div className="relative z-10 text-center">
          <div className="uppercase font-black text-sm sm:text-base tracking-tight mb-4 opacity-70">Loading Type Specimen</div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--ink)]" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}></div>
            <div className="w-3 h-3 rounded-full bg-[var(--ink)]" style={{ animation: 'pulse 1.5s ease-in-out 0.2s infinite' }}></div>
            <div className="w-3 h-3 rounded-full bg-[var(--ink)]" style={{ animation: 'pulse 1.5s ease-in-out 0.4s infinite' }}></div>
          </div>
          <div className="mt-6 uppercase text-xs font-bold tracking-wide opacity-60">Analyzing font metrics & glyphs</div>
        </div>
      </div>
    </section>
  );
}
