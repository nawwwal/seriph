import { describe, expect, it } from "vitest";
import { aliasTargetDocId, isAliasFamilyDoc } from "../../src/storage/familyAlias";

describe("family alias helpers", () => {
  it("detects hidden merge tombstones", () => {
    expect(isAliasFamilyDoc({ status: "merged", hidden: true })).toBe(true);
    expect(isAliasFamilyDoc({ status: "ready" })).toBe(false);
  });

  it("prefers stored owner-scoped target ids over slug fallback", () => {
    expect(aliasTargetDocId({ ownerId: "user-1", mergedIntoId: "user-1__inter", mergedInto: "inter" })).toBe("user-1__inter");
    expect(aliasTargetDocId({ ownerId: "user-1", aliasOf: "inter" })).toBe("user-1__inter");
  });
});
