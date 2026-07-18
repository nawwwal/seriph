import { describe, expect, it } from "vitest";
import { preflightFamily } from "../../src/enrichment/preflight";
import type { FontFamilyDoc } from "../../src/models/catalog.models";

describe("preflightFamily", () => {
  it("rejects a family without owner or faces without throwing", () => {
    expect(preflightFamily({ id: "chap", status: "ready", faces: [] } as FontFamilyDoc)).toEqual({
      kind: "rejected",
      code: "invalid_family",
      reasons: ["missing_owner", "missing_faces"],
    });
  });
});
