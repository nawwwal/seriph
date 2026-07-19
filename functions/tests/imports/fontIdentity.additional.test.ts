import { describe, expect, it } from "vitest";
import {
  resolvePlannedFontIdentity,
  type PlannedFontInput,
} from "../../src/imports/planning/identity";
import { resolvePlannedFontIdentity as resolveFromCanonicalize } from "../../src/storage/canonicalize";

const parsedFixture = (overrides: Partial<PlannedFontInput> = {}): PlannedFontInput => ({
  filename: "Wrong-Regular.ttf",
  format: "TTF",
  familyName: "Wrong Family Regular",
  subfamilyName: "Regular",
  postScriptName: "WrongFamily-Regular",
  ...overrides,
});

describe("planned font identity additional cases", () => {
  it("produces a deterministic logical key independent of axis order and punctuation", () => {
    const axes = [
      { tag: "wght", minValue: 100, maxValue: 900, defaultValue: 400 },
      { tag: "opsz", minValue: 8, maxValue: 72, defaultValue: 14 },
    ];
    const first = resolvePlannedFontIdentity(parsedFixture({
      preferredFamily: "Right Family",
      preferredSubfamily: "Bold Italic",
      weight: 700,
      width: 100,
      italic: true,
      opticalSize: 14,
      variableAxes: axes,
      postScriptName: "RightFamily-BoldItalic",
    }));
    const second = resolvePlannedFontIdentity(parsedFixture({
      preferredFamily: " Right\u00a0Family ",
      preferredSubfamily: "Bold_Italic",
      weight: 700,
      width: 100,
      italic: true,
      opticalSize: 14,
      variableAxes: [
        { tag: "opsz", minValue: 8, maxValue: 72, defaultValue: 14 },
        { tag: "wght", minValue: 100, maxValue: 900, defaultValue: 400 },
      ],
      postScriptName: "RightFamily-BoldItalic",
    }));

    expect(first.logicalFaceKey).toBe(second.logicalFaceKey);
    expect(first.logicalFaceKey).toContain("bold-italic");
    expect(first.logicalFaceKey).toContain("axes-opsz-8-72-14_wght-100-900-400");
    expect(first.logicalFaceKey).not.toBe(resolvePlannedFontIdentity(parsedFixture({
      preferredFamily: "Right Family", preferredSubfamily: "Bold Italic", weight: 700, width: 90, italic: true,
      opticalSize: 14, variableAxes: axes, postScriptName: "RightFamily-BoldItalic",
    })).logicalFaceKey);
    expect(first.logicalFaceKey).not.toBe(resolvePlannedFontIdentity(parsedFixture({
      preferredFamily: "Right Family", preferredSubfamily: "Bold Italic", weight: 700, width: 100, italic: false,
      opticalSize: 14, variableAxes: axes, postScriptName: "RightFamily-BoldItalic",
    })).logicalFaceKey);
  });

  it("exposes the same resolver through the canonicalize barrel", () => {
    const input = parsedFixture({ preferredFamily: "Barrel Family", preferredSubfamily: "Medium" });
    expect(resolveFromCanonicalize(input)).toEqual(resolvePlannedFontIdentity(input));
  });
});
