import { describe, expect, it } from "vitest";
import { catalogFamilyDocId, catalogFamilyDocIdFor, legacyCatalogDocId } from "../../src/storage/catalogIdentity";

describe("catalog family identity", () => {
  it("scopes new catalog document ids by owner", () => {
    expect(catalogFamilyDocId("user-1", "inter")).toBe("user-1__inter");
  });

  it("keeps legacy slug ids when no owner is available", () => {
    expect(catalogFamilyDocId(undefined, "inter")).toBe("inter");
    expect(legacyCatalogDocId("inter")).toBe("inter");
  });

  it("uses an existing document id when a family snapshot already has one", () => {
    expect(catalogFamilyDocIdFor({ id: "user-1__inter", ownerId: "user-1", slug: "inter" })).toBe("user-1__inter");
  });
});
