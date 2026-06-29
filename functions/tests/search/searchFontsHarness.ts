import { vi } from "vitest";
import type { FontFamilyDoc } from "../../src/models/catalog.models";
type FakeDoc = {
  id: string;
  data: () => FontFamilyDoc;
  get: (field: string) => unknown;
};
export const queries: FakeQuery[] = [];
let scenario = "useCase";
export function setSearchScenario(next: string): void {
  scenario = next;
}
export function resetSearchHarness(): void {
  queries.length = 0;
  scenario = "useCase";
}
function makeDoc(family: FontFamilyDoc, distance?: number): FakeDoc {
  return {
    id: family.id,
    data: () => family,
    get: (field: string) => (field === "_distance" ? distance : undefined),
  };
}
function family(id: string, overrides: Partial<FontFamilyDoc> = {}): FontFamilyDoc {
  return {
    id,
    slug: id,
    name: id === "garamond-premier" ? "Garamond Premier" : id === "warm-sans" ? "Warm Sans" : "Editorial Grotesk",
    fileBase: id,
    category: id === "garamond-premier" ? "SERIF" : "SANS_SERIF",
    faces: [],
    ownerId: "owner-1",
    status: "enriched",
    version: 1,
    searchTokens: id === "garamond-premier"
      ? ["garamond", "premier", "serif"]
      : id === "warm-sans" ? ["warm", "branding", "sans"] : ["editorial", "magazine", "grotesk"],
    enrichment: {
      category: id === "garamond-premier" ? "SERIF" : "SANS_SERIF",
      moods: id === "warm-sans" ? ["warm"] : ["precise"],
      useCases: id === "editorial-grotesk" ? ["editorial"] : ["branding"],
      confidence: 0.9,
    },
    ...overrides,
  };
}
export class FakeQuery {
  readonly filters: Array<[string, string, unknown]>;
  readonly limitValue?: number;
  readonly vectorField?: string;
  constructor(input: { filters?: Array<[string, string, unknown]>; limitValue?: number; vectorField?: string } = {}) {
    this.filters = input.filters ?? [];
    this.limitValue = input.limitValue;
    this.vectorField = input.vectorField;
    queries.push(this);
  }
  where(field: string, op: string, value: unknown): FakeQuery {
    return new FakeQuery({ filters: [...this.filters, [field, op, value]], limitValue: this.limitValue, vectorField: this.vectorField });
  }
  limit(limitValue: number): FakeQuery {
    return new FakeQuery({ filters: this.filters, limitValue, vectorField: this.vectorField });
  }
  findNearest(options: { vectorField: string }): FakeQuery {
    return new FakeQuery({ filters: this.filters, limitValue: this.limitValue, vectorField: options.vectorField });
  }
  orderBy(): FakeQuery { return this; }
  startAfter(): FakeQuery { return this; }
  async get(): Promise<{ docs: FakeDoc[]; size: number }> {
    const docs = docsForQuery(this);
    return { docs, size: docs.length };
  }
}
function docsForQuery(query: FakeQuery): FakeDoc[] {
  if (!query.vectorField && query.filters.some(([field]) => field === "searchTokens")) {
    if (scenario === "exactName") return [makeDoc(family("garamond-premier"))];
    if (scenario === "useCase") return [makeDoc(family("editorial-grotesk"))];
    return [makeDoc(family("warm-sans"))];
  }
  if (query.vectorField === "use_case_vec" && scenario === "useCase") return [makeDoc(family("editorial-grotesk"), 0.05)];
  if (query.vectorField === "mood_vec" && scenario === "mood") return [makeDoc(family("warm-sans"), 0.02)];
  if (query.vectorField === "text_vec" && scenario === "exactName") return [makeDoc(family("warm-sans"), 0.9)];
  if (!query.vectorField && scenario === "fallback") return [makeDoc(family("editorial-grotesk")), makeDoc(family("warm-sans"))];
  return [];
}
vi.mock("firebase-admin/firestore", () => ({
  FieldPath: { documentId: () => "__name__" },
  getFirestore: () => ({ collection: () => new FakeQuery() }),
}));
