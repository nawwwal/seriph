import AppShell from '@/components/layout/AppShell';

function Block({ className }: { className: string }) {
  return <div className={`${className} rounded-[var(--radius)] bg-[var(--muted)] pulse`} />;
}

export default function SearchWorkspaceFallback() {
  return (
    <AppShell
      sidebar={
        <div className="min-w-0 w-full space-y-3 px-3 py-3 sm:px-4 md:px-5 md:pt-6" aria-hidden="true">
          <Block className="h-4 w-24" />
          <Block className="h-7 w-full rule" />
          <Block className="h-7 w-5/6 rule" />
          <Block className="h-7 w-2/3 rule" />
          <Block className="mt-4 h-4 w-16" />
          <Block className="h-7 w-full rule" />
        </div>
      }
    >
      <main
        className="h-full min-h-0 w-full overflow-auto px-5 py-6 sm:px-6 md:px-8 md:py-8"
        aria-hidden="true"
      >
        <Block className="mb-6 h-14 w-full max-w-xl sm:h-16" />
        <div className="flex max-w-3xl gap-2">
          <Block className="h-10 flex-1 rule" />
          <Block className="h-10 w-24 rule" />
        </div>
        <Block className="mt-6 h-3 w-32" />
        <div className="mt-4 grid grid-cols-1 grid-poster-gap auto-rows-fr content-start sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="min-h-72 overflow-hidden rounded-[var(--radius)] rule">
              <Block className="h-44 rounded-none" />
              <div className="space-y-3 p-4 rule-t">
                <Block className="h-6 w-3/4" />
                <Block className="h-3 w-full" />
                <Block className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
