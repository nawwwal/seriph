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
    expect(resolvePlannedFontIdentity(parsedFixture({ format: "WOFF2", isVariable: true })).technology).toBe("WOFF2");
  });

  it("uses the complete metadata precedence ladder before filename context", () => {
    expect(resolvePlannedFontIdentity(parsedFixture({
      familyName: "Legacy Family Bold",
      subfamilyName: "Legacy Bold",
      preferredFamily: "Preferred Family",
      preferredSubfamily: "Preferred Style",
      wwsFamilyName: "WWS Family",
      wwsSubfamilyName: "WWS Style",
      fullName: "Full Name Style",
      postScriptName: "PostScript-Style",
    })).styleName).toBe("Preferred Style");

    expect(resolvePlannedFontIdentity(parsedFixture({
      familyName: "Legacy Family",
      subfamilyName: "Legacy Style",
      wwsFamilyName: "WWS Family",
      wwsSubfamilyName: "WWS Style",
      fullName: "Full Name Style",
      postScriptName: "PostScript-Style",
    })).familyName).toBe("WWS Family");

    expect(resolvePlannedFontIdentity(parsedFixture({
      familyName: "Legacy Family",
      subfamilyName: "Legacy Style",
      fullName: "Full Name Style",
      postScriptName: "PostScript-Style",
    })).styleName).toBe("Legacy Style");
  });

  it("uses full name, PostScript name, then filename as controlled fallbacks", () => {
    expect(resolvePlannedFontIdentity(parsedFixture({
      familyName: undefined,
      subfamilyName: undefined,
      fullName: "Full Family Bold",
      postScriptName: undefined,
    })).familyName).toBe("Full Family");
    expect(resolvePlannedFontIdentity(parsedFixture({
      familyName: undefined,
      subfamilyName: undefined,
      fullName: undefined,
      postScriptName: "PostScriptFamily-Bold",
    })).familyName).toBe("PostScriptFamily");
    expect(resolvePlannedFontIdentity(parsedFixture({
      familyName: undefined,
      subfamilyName: undefined,
      fullName: undefined,
      postScriptName: undefined,
      filename: "Filename Family-Bold.ttf",
    })).familyName).toBe("Filename Family");
  });

  it("keeps compatibility-distinct Unicode keys distinct under NFC", () => {
    const ligature = resolvePlannedFontIdentity(parsedFixture({ familyName: "ﬀ Sans" }));
    const letters = resolvePlannedFontIdentity(parsedFixture({ familyName: "ff Sans" }));
    expect(ligature.familyKey).not.toBe(letters.familyKey);
    expect(ligature.familyKey).toBe("ﬀ-sans");
  });

});
