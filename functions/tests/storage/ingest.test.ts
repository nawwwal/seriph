import { describe, expect, it } from "vitest";
import { planIngestedFont } from "../../src/storage/ingest";
import { buildFace } from "../../src/storage/buildFace";

describe("production ingest identity consumer", () => {
  it("uses the planned identity for persistence-facing family, format, variable state, and face key", () => {
    const plan = planIngestedFont({
      familyName: "Wrong Family Bold",
      subfamilyName: "Regular",
      preferredFamily: "Right Family",
      preferredSubfamily: "Bold",
      postScriptName: "RightFamily-Bold",
      format: "WOFF2",
      isVariable: true,
      variableAxes: [],
      classification: "Sans Serif",
    }, "Wrong-Regular.ttf");

    expect(plan).toMatchObject({
      familyName: "Right Family",
      slug: "right-family",
      format: "WOFF2",
      isVariable: false,
      faceId: plan.identity.logicalFaceKey,
    });
    expect(plan.identity.technology).toBe("WOFF2");
  });

  it("persists italic when the planned variable ital axis defaults to 1", () => {
    const plan = planIngestedFont({
      familyName: "Axis Family",
      subfamilyName: "Regular",
      preferredFamily: "Axis Family",
      preferredSubfamily: "Regular",
      postScriptName: "AxisFamily-Regular",
      format: "TTF",
      variableAxes: [
        { tag: "wght", minValue: 100, maxValue: 900, defaultValue: 400 },
        { tag: "ital", minValue: 0, maxValue: 1, defaultValue: 1 },
      ],
    }, "AxisFamily-Regular.ttf");

    expect(plan.identity.italic).toBe(true);
    expect(plan.italic).toBe(true);
    expect(plan.faceId).toContain("italic-yes");
  });

  it("passes canonical non-normal width from the plan into the persisted face", () => {
    const plan = planIngestedFont({
      familyName: "Width Family",
      subfamilyName: "Regular",
      preferredFamily: "Width Family",
      preferredSubfamily: "Regular",
      postScriptName: "WidthFamily-Regular",
      format: "TTF",
      variableAxes: [
        { tag: "wght", minValue: 100, maxValue: 900, defaultValue: 400 },
        { tag: "wdth", minValue: 75, maxValue: 125, defaultValue: 125 },
      ],
    }, "WidthFamily-Regular.ttf");
    const face = buildFace({
      parsed: { postScriptName: "WidthFamily-Regular" },
      faceId: plan.faceId,
      styleName: plan.styleName,
      weight: plan.weight,
      weightName: plan.weightName,
      italic: plan.italic,
      isVariable: plan.isVariable,
      width: plan.width,
      axes: plan.axes,
      format: plan.format,
      fileSize: 1,
      servedFilename: "width.woff2",
      servedStoragePath: "s/width/1/width.woff2",
      origStoragePath: "d/width/1/width.ttf",
      contentHash: "hash",
    });

    expect(plan.identity.width).toBe(125);
    expect(plan.width).toBe(plan.identity.width);
    expect(face.width).toBe(plan.identity.width);
    expect(face.id).toBe(plan.identity.logicalFaceKey);
    expect(face.id).toContain("wdth-125");
  });
});
