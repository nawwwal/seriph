import { describe, expect, it } from "vitest";
import type { FontAsset } from "../../src/models/catalog.assets";
import { buildFace } from "../../src/storage/buildFace";

const asset = (id: string, format: FontAsset["containerFormat"], technology: FontAsset["technology"]): FontAsset => ({
  id,
  contentHash: `${id}-hash`,
  containerFormat: format,
  technology,
  originalName: `Atlas-${id}.${format.toLowerCase()}`,
  original: { storagePath: `d/atlas/1/${id}`, url: `https://cdn.test/d/${id}` },
  served: format === "WOFF2"
    ? { storagePath: `s/atlas/1/${id}.woff2`, url: `https://cdn.test/s/${id}.woff2` }
    : undefined,
  source: { batchId: "batch-1", sourceId: "source-1", itemId: id, originalPath: `fonts/${id}` },
});

function buildFaceWithAssets(assets: FontAsset[], preferredAssetId?: string) {
  return buildFace({
    parsed: { familyName: "Atlas", subfamilyName: "Regular" },
    faceId: "regular", styleName: "Regular", weight: 400, weightName: "Regular",
    width: 100, italic: false, isVariable: false, fileSize: 42, assets, preferredAssetId,
  });
}

describe("logical face asset variants", () => {
  it("retains alternate formats while projecting the preferred asset", () => {
    const otf = asset("otf", "OTF", "OTF");
    const woff2 = asset("woff2", "WOFF2", "WOFF2");
    const face = buildFaceWithAssets([woff2, otf]);

    expect(face.assets?.map((entry) => entry.containerFormat)).toEqual(["OTF", "WOFF2"]);
    expect(face.preferredAssetId).toBe(woff2.id);
    expect(face.format).toBe("WOFF2");
    expect(face.technology).toBe("WOFF2");
    expect(face.filename).toBe("woff2.woff2");
    expect(face.contentHash).toBe(woff2.contentHash);
  });

  it("honors an explicit preferred asset without overwriting variants", () => {
    const otf = asset("otf", "OTF", "OTF");
    const woff2 = asset("woff2", "WOFF2", "WOFF2");
    const face = buildFaceWithAssets([otf, woff2], otf.id);

    expect(face.assets).toHaveLength(2);
    expect(face.preferredAssetId).toBe(otf.id);
    expect(face.format).toBe("OTF");
    expect(face.technology).toBe("OTF");
  });

  it("rejects duplicate asset ids instead of silently replacing an asset", () => {
    const first = asset("same", "OTF", "OTF");
    expect(() => buildFaceWithAssets([first, { ...first, contentHash: "other" }])).toThrow(/duplicate asset/i);
  });
});
