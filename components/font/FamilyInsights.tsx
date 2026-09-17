import Link from 'next/link';
import type { FamilyEnrichment } from '@/models/font-family.models';

interface FamilyInsightsProps {
  enrichment?: FamilyEnrichment;
}

function Chips({ label, values, filled = false }: { label: string; values?: string[]; filled?: boolean }) {
  if (!values?.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-black uppercase opacity-60">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span key={value} className={`px-2 py-1 text-xs font-bold uppercase ${filled ? 'ink-bg' : 'rule bg-[var(--paper)]'}`}>
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function bestFor(enrichment: FamilyEnrichment): string[] | undefined {
  const values = enrichment.useCases;
  if (!values?.length) return undefined;
  const scores = enrichment.useCaseScores;
  if (!scores) return values;
  const primary = values.filter((value) => (scores[value] ?? 0) >= 2);
  if (primary.length) return primary;
  return values.filter((value) => (scores[value] ?? 0) >= 1).slice(0, 3);
}

function analysisDate(value?: string): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
}

export default function FamilyInsights({ enrichment }: FamilyInsightsProps) {
  if (!enrichment) return null;
  const date = analysisDate(enrichment.enrichedAt);
  const pairingFamilies = enrichment.pairingFamilies ?? [];
  const shownUseCases = bestFor(enrichment);
  const hasTags = Boolean(enrichment.moods?.length || shownUseCases?.length);
  const hasContent = Object.values(enrichment).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined && value !== ''
  );
  if (!hasContent) return null;

  return (
    <section className="mt-10 rule-t rule-b py-5 sm:py-6" aria-labelledby="family-insights-title">
      <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
        <div>
          <h2 id="family-insights-title" className="text-xl font-black uppercase sm:text-2xl">AI Insights</h2>
          {enrichment.summary && <p className="mt-3 max-w-3xl text-base sm:text-lg">{enrichment.summary}</p>}
          {hasTags && <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Chips label="Mood" values={enrichment.moods} filled />
            <Chips label="Best for" values={shownUseCases} />
          </div>}
        </div>
        <dl className="grid content-start gap-3 text-sm">
          {enrichment.voice && <div><dt className="text-[10px] font-black uppercase opacity-60">Voice</dt><dd className="mt-1">{enrichment.voice}</dd></div>}
          {enrichment.classification && <div><dt className="text-[10px] font-black uppercase opacity-60">Classification</dt><dd className="mt-1">{enrichment.classification}</dd></div>}
          {pairingFamilies.length > 0 && (
            <div>
              <dt className="text-[10px] font-black uppercase opacity-60">Pairing</dt>
              <dd className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                {pairingFamilies.map((family) => (
                  <Link key={family.id} href={`/family/${family.slug}`} className="underline-offset-2 hover:underline">
                    {family.name}
                  </Link>
                ))}
              </dd>
            </div>
          )}
          {enrichment.confidence !== undefined && <div><dt className="text-[10px] font-black uppercase opacity-60">Confidence</dt><dd className="mt-1">{Math.round(enrichment.confidence * 100)}%</dd></div>}
          {date && <div><dt className="text-[10px] font-black uppercase opacity-60">Analyzed</dt><dd className="mt-1">{date}</dd></div>}
        </dl>
      </div>
    </section>
  );
}
