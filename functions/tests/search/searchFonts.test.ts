import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FontFamilyDoc } from "../../src/models/catalog.models";

type FakeDoc = {
  id: string;
  data: () => FontFamilyDoc;
  get: (field: string) => unknown;
};

const queries: FakeQuery[] = [];
let scenario = "useCase";

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
    searchTokens:
      id === "garamond-premier"
        ? ["garamond", "premier", "serif"]
        : id === "warm-sans"
          ? ["warm", "branding", "sans"]
          : ["editorial", "magazine", "grotesk"],
    enrichment: {
      category: id === "garamond-premier" ? "SERIF" : "SANS_SERIF",
      moods: id === "warm-sans" ? ["warm"] : ["precise"],
      useCases: id === "editorial-grotesk" ? ["editorial"] : ["branding"],
      confidence: 0.9,
    },
    ...overrides,
  };
}

class FakeQuery {
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

  if (query.vectorField === "use_case_vec" && scenario === "useCase") {
    return [makeDoc(family("editorial-grotesk"), 0.05)];
  }
  if (query.vectorField === "mood_vec" && scenario === "mood") {
    return [makeDoc(family("warm-sans"), 0.02)];
  }
  if (query.vectorField === "text_vec" && scenario === "exactName") {
    return [makeDoc(family("warm-sans"), 0.9)];
  }
  if (!query.vectorField && scenario === "fallback") {
    return [makeDoc(family("editorial-grotesk")), makeDoc(family("warm-sans"))];
  }
  return [];
}

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: () => new FakeQuery(),
  }),
}));

vi.mock("firebase-functions", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../src/search/queryEmbeddingCache", () => ({
  getOrCreateQueryEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
}));

describe("searchFonts", () => {
  beforeEach(() => {
    queries.length = 0;
    scenario = "useCase";
  });

  it("lets editorial queries rank through the use-case vector lane", async () => {
    const { searchFonts } = await import("../../src/search/searchFonts");

    const response = await searchFonts({ q: "editorial", filters: { ownerId: "owner-1" }, limit: 5, debug: true });

    expect(response.results[0]?.id).toBe("editorial-grotesk");
    expect(response.results[0]?.scoreBreakdown?.useCaseSemantic).toBeGreaterThan(0.9);
  });

  it("lets warm queries rank through the mood vector lane", async () => {
    scenario = "mood";
    const { searchFonts } = await import("../../src/search/searchFonts");

    const response = await searchFonts({ q: "warm", filters: { ownerId: "owner-1" }, limit: 5, debug: true });

    expect(response.results[0]?.id).toBe("warm-sans");
    expect(response.results[0]?.scoreBreakdown?.moodSemantic).toBeGreaterThan(0.9);
  });

  it("lets an exact family name outrank weak semantic matches", async () => {
    scenario = "exactName";
    const { searchFonts } = await import("../../src/search/searchFonts");

    const response = await searchFonts({ q: "Garamond Premier", filters: { ownerId: "owner-1" }, limit: 5, debug: true });

    expect(response.results[0]?.id).toBe("garamond-premier");
    expect(response.results[0]?.scoreBreakdown?.exact).toBe(1);
  });

  it("applies owner filtering to all Firestore lanes", async () => {
    const { searchFonts } = await import("../../src/search/searchFonts");

    await searchFonts({ q: "editorial", filters: { ownerId: "owner-1" }, limit: 5 });

    const laneQueries = queries.filter((query) => query.vectorField || query.filters.some(([field]) => field === "searchTokens"));
    expect(laneQueries.length).toBeGreaterThanOrEqual(4);
    expect(laneQueries.every((query) => query.filters.some(([field, op, value]) => field === "ownerId" && op === "==" && value === "owner-1"))).toBe(true);
  });

  it("falls back to ready/enriched listing when the query is empty", async () => {
    scenario = "fallback";
    const { searchFonts } = await import("../../src/search/searchFonts");

    const response = await searchFonts({ filters: { ownerId: "owner-1" }, limit: 5 });

    expect(response.results.map((result) => result.id)).toEqual(["editorial-grotesk", "warm-sans"]);
  });
});
