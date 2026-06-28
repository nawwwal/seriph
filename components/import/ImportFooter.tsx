export default function ImportFooter() {
  return (
    <footer className="mt-8 sm:mt-10 md:mt-12 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rule-r pr-4">
          <div className="uppercase font-bold">About</div>
          <p className="mt-2">Browse, test, and rediscover your own type. One color, many voices.</p>
        </div>
        <div className="rule-r pr-4">
          <div className="uppercase font-bold">Tips</div>
          <ul className="mt-2 list-disc pl-5 leading-tight">
            <li>Drop the whole messy folder — zips and subfolders are fine.</li>
            <li>Duplicates are detected and skipped automatically.</li>
          </ul>
        </div>
        <div>
          <div className="uppercase font-bold">Supported</div>
          <p className="mt-2 uppercase text-xs font-bold">TTF · OTF · WOFF · WOFF2 · ZIP · FOLDERS</p>
        </div>
      </div>
    </footer>
  );
}
