import { normalizeTaxonomyToken, parseMood, parseUseCase } from "../ai/taxonomies";

export interface LabelCensusRow {
  value: string;
  count: number;
  inTaxonomy: boolean;
  normalized: string;
}

export interface LabelCensus {
  families: number;
  moods: LabelCensusRow[];
  useCases: LabelCensusRow[];
  moodOffTaxonomyShare: number;
  useCaseOffTaxonomyShare: number;
}

export interface CensusFamily {
  enrichment?: { moods?: unknown; useCases?: unknown };
}

function tally(values: unknown[], parse: (value: string) => string | undefined): LabelCensusRow[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      count,
      normalized: normalizeTaxonomyToken(value),
      inTaxonomy: parse(value) !== undefined,
    }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function offShare(rows: LabelCensusRow[]): number {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return 0;
  const off = rows.filter((row) => !row.inTaxonomy).reduce((sum, row) => sum + row.count, 0);
  return off / total;
}

export function censusEnrichmentLabels(families: CensusFamily[]): LabelCensus {
  const moods = families.flatMap((family) => (Array.isArray(family.enrichment?.moods) ? family.enrichment.moods : []));
  const useCases = families.flatMap((family) => (Array.isArray(family.enrichment?.useCases) ? family.enrichment.useCases : []));
  const moodRows = tally(moods, parseMood);
  const useCaseRows = tally(useCases, parseUseCase);
  return {
    families: families.length,
    moods: moodRows,
    useCases: useCaseRows,
    moodOffTaxonomyShare: offShare(moodRows),
    useCaseOffTaxonomyShare: offShare(useCaseRows),
  };
}

export function parseCensusArgs(argv: string[]): { ownerId?: string; limit?: number } {
  const parsed: { ownerId?: string; limit?: number } = {};
  for (const arg of argv) {
    if (arg.startsWith("--ownerId=")) parsed.ownerId = arg.slice("--ownerId=".length);
    if (arg.startsWith("--limit=")) parsed.limit = Number(arg.slice("--limit=".length));
  }
  return parsed;
}

if (require.main === module) {
  import("./auditEnrichmentLabelsRunner")
    .then(({ runEnrichmentLabelCensus }) => runEnrichmentLabelCensus())
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
