import type { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import { exportCatalogCsv } from '@/lib/utils/exportCatalog';

export default function HomeFooter({ families }: { families: Array<FontFamily | ShelfFamily> }) {
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
            <li>Upload every style so families group cleanly.</li>
            <li>Keep weight and style in the filename for sharper grouping.</li>
          </ul>
        </div>
        <div>
          <div className="uppercase font-bold">Export</div>
          <button
            onClick={() => exportCatalogCsv(families)}
            disabled={families.length === 0}
            className={`mt-2 uppercase font-bold rule px-3 py-2 rounded-[var(--radius)] btn-ink text-sm ${families.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Download Catalog CSV
          </button>
        </div>
      </div>
    </footer>
  );
}
