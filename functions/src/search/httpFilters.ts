import type { SearchRequest } from "./searchTypes";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

const STYLE_RANGES = new Set(["1", "2-4", "5-8", "9+"]);
const VARIABLES = new Set(["any", "variable", "static"]);

export function parseHttpSearchFilters(raw: unknown, ownerId: string): NonNullable<SearchRequest["filters"]> {
  const filters = isRecord(raw) ? raw : {};
  const styleRanges = strings(filters.styleRanges).filter((value): value is NonNullable<NonNullable<SearchRequest["filters"]>["styleRanges"]>[number] => STYLE_RANGES.has(value));
  const variable = typeof filters.variable === "string" && VARIABLES.has(filters.variable)
    ? filters.variable as NonNullable<SearchRequest["filters"]>["variable"]
    : undefined;
  return {
    ownerId,
    category: typeof filters.category === "string" ? filters.category : undefined,
    classifications: strings(filters.classifications),
    moods: strings(filters.moods),
    useCases: strings(filters.useCases),
    styleRanges,
    variable,
    isVariable: typeof filters.isVariable === "boolean" ? filters.isVariable : undefined,
  };
}
