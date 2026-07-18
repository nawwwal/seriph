import { describe, expect, it } from "vitest";
import {
  resolvePlannedFontIdentity,
  type PlannedFontInput,
} from "../../src/imports/planning/identity";

const parsedFixture = (overrides: Partial<PlannedFontInput> = {}): PlannedFontInput => ({
  filename: "Wrong-Regular.ttf",
  format: "TTF",
  familyName: "Wrong Family Regular",
  subfamilyName: "Regular",
  postScriptName: "WrongFamily-Regular",
  ...overrides,
});

describe("planned font identity", () => {
  it("uses preferred family and axes when the filename disagrees", () => {
    expect(resolvePlannedFontIdentity(parsedFixture({
      preferredFamily: "Right Family",
      preferredSubfamily: "Text Bold",
      variableAxes: [{ tag: "wght", minValue: 100, maxValue: 900, defaultValue: 400 }],
    }))).toMatchObject({
      familyName: "Right Family",
      styleName: "Text Bold Variable",
      technology: "Variable",
    });
  });

  it("normalizes Unicode display names and makes equivalent keys identical", () => {
    const composed = resolvePlannedFontIdentity(parsedFixture({
      familyName: "Café  Sans",
      subfamilyName: "Regular",
    }));
    const decomposed = resolvePlannedFontIdentity(parsedFixture({
      familyName: "Cafe\u0301 Sans",
      subfamilyName: "Regular",
    }));

    expect(composed.familyName).toBe("Café Sans");
    expect(composed.familyKey).toBe(decomposed.familyKey);
    expect(composed.familyKey).toBe("café-sans");
  });

  it("preserves a genuine family cut when metadata does not call it a style", () => {
    expect(resolvePlannedFontIdentity(parsedFixture({
      familyName: "ABC Ginto Normal",
      subfamilyName: "Regular",
      postScriptName: "ABCGintoNormal-Regular",
    })).familyName).toBe("ABC Ginto Normal");
  });

  it("uses the container only when no variation axes are present", () => {
    expect(resolvePlannedFontIdentity(parsedFixture({
      format: "WOFF2",
      variableAxes: [{ tag: "wdth", minValue: 75, maxValue: 125, defaultValue: 100 }],
    })).technology).toBe("Variable");
    expect(resolvePlannedFontIdentity(parsedFixture({ format: "WOFF2" })).technology).toBe("WOFF2");
  });

  it("produces a deterministic logical key independent of axis order and punctuation", () => {
    const first = resolvePlannedFontIdentity(parsedFixture({
      preferredFamily: "Right Family",
      preferredSubfamily: "Bold Italic",
      weight: 700,
      width: 100,
      italic: true,
      opticalSize: 14,
      variableAxes: [
        { tag: "wght", minValue: 100, maxValue: 900, defaultValue: 400 },
        { tag: "opsz", minValue: 8, maxValue: 72, defaultValue: 14 },
      ],
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
  });
});
