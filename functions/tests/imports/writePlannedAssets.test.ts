import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { writePlannedAssets } from "../../src/imports/apply/writePlannedAssets";

const bytes = Buffer.from("public-font-bytes");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const asset = { assetId: "regular", itemId: "item-1", sha256, format: "OTF", version: "1" };
const claim = { ownerId: "ada", batchId: "batch", itemId: "item-1", sha256, familyId: "atlas", logicalFaceKey: "regular", assetId: "regular", bytes };

describe("writePlannedAssets", () => {
  it("publishes verified bytes through the public s/d CDN contract", async () => {
    const saves: Array<{ path: string; bytes: Buffer }> = [];
    const bucket = { file: (path: string) => ({ save: async (value: Buffer) => { saves.push({ path, bytes: value }); } }) };
    const [written] = await writePlannedAssets({ ownerId: "ada", familyId: "atlas", familySlug: "atlas", assets: [asset], claims: [claim] }, { publicBucket: bucket as any });
    expect(saves.map((entry) => entry.path)).toEqual([`d/atlas/${sha256}/regular.otf`, `s/atlas/${sha256}/regular.otf`]);
    expect(written).toMatchObject({ originalPath: `d/atlas/${sha256}/regular.otf`, servedPath: `s/atlas/${sha256}/regular.otf`, originalUrl: expect.stringContaining(`/d/atlas/${sha256}/regular.otf`), servedUrl: expect.stringContaining(`/s/atlas/${sha256}/regular.otf`) });
  });

  it("refuses a mismatched download before writing either public artifact", async () => {
    const saves: string[] = [];
    const bucket = { file: (path: string) => ({ save: async () => { saves.push(path); } }) };
    await expect(writePlannedAssets({ ownerId: "ada", familyId: "atlas", familySlug: "atlas", assets: [asset], claims: [{ ...claim, bytes: Buffer.from("tampered") }] }, { publicBucket: bucket as any })).rejects.toThrow("sha256");
    expect(saves).toEqual([]);
  });
});
