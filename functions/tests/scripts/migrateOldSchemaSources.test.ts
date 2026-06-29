import { describe, expect, it } from "vitest";
import {
  collectLegacyFontSources,
  hasCompletedOldSchemaMigration,
  isCatalogFamilyDoc,
  parseMigrationArgs,
} from "../../src/scripts/migrateOldSchemaFonts";

describe("old schema migration sources", () => {
  it("parses safe production controls", () => {
    expect(parseMigrationArgs([
      "--ownerId=user-1",
      "--familyIds=editorial-sans,luxury-serif",
      "--limit=25",
      "--dryRun",
      "--force",
      "--skipVectors",
    ])).toEqual({
      ownerId: "user-1",
      familyIds: ["editorial-sans", "luxury-serif"],
      limit: 25,
      dryRun: true,
      force: true,
      recomputeVectors: false,
      allOwners: false,
    });
    expect(parseMigrationArgs(["--allOwners"])).toMatchObject({ allOwners: true, recomputeVectors: true });
  });

  it("distinguishes rebuilt catalog docs from legacy family docs", () => {
    expect(isCatalogFamilyDoc({ faces: [] })).toBe(true);
    expect(isCatalogFamilyDoc({ fonts: [] })).toBe(false);
  });

  it("recognizes previously completed legacy migrations", () => {
    expect(hasCompletedOldSchemaMigration({ oldSchemaMigration: { version: "2026-06-old-schema-fonts", targetPath: "fontfamilies/a" } })).toBe(true);
    expect(hasCompletedOldSchemaMigration({ oldSchemaMigration: { version: "old", targetPath: "fontfamilies/a" } })).toBe(false);
  });

  it("collects legacy font source paths without treating missing files as usable", () => {
    expect(collectLegacyFontSources({
      fonts: [
        { id: "regular", filename: "Family-Regular.otf", metadata: { storagePath: "processed_fonts/a.otf" } },
        { id: "bold", filename: "Family-Bold.otf", storagePath: "gs://custom-bucket/fonts/b.otf" },
        { id: "broken", filename: "Missing.otf", metadata: { cdnUrl: "https://seriph.web.app/s/family/a.woff2" } },
      ],
    })).toEqual([
      { fontId: "regular", filename: "Family-Regular.otf", bucketName: undefined, storagePath: "processed_fonts/a.otf" },
      { fontId: "bold", filename: "Family-Bold.otf", bucketName: "custom-bucket", storagePath: "fonts/b.otf" },
    ]);
  });
});
