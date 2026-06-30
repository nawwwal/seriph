function Block({ className }: { className: string }) {
  return <div className={`${className} rounded-[var(--radius)] bg-[var(--muted)] pulse`} />;
}

export default function SearchWorkspaceFallback() {
  return (
    <main className="flex-1 w-full px-8 sm:px-10 md:px-12 lg:px-16 py-10 overflow-auto" aria-hidden="true">
      <Block className="h-14 sm:h-16 w-full max-w-xl mb-6" />
      <div className="flex gap-2 max-w-3xl">
        <Block className="h-10 flex-1 rule" />
        <Block className="h-10 w-24 rule" />
      </div>
      <Block className="mt-6 h-3 w-32" />
      <div className="mt-4 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rule rounded-[var(--radius)] p-4 space-y-3">
          <Block className="h-4 w-24" />
          <Block className="h-7 w-full rule" />
          <Block className="h-7 w-5/6 rule" />
          <Block className="h-7 w-2/3 rule" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 grid-poster-gap auto-rows-fr content-start">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="rule rounded-[var(--radius)] overflow-hidden min-h-72">
              <Block className="h-44 rounded-none" />
              <div className="rule-t p-4 space-y-3">
                <Block className="h-6 w-3/4" />
                <Block className="h-3 w-full" />
                <Block className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
