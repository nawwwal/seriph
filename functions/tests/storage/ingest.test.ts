import { describe, expect, it } from "vitest";
import { planIngestedFont } from "../../src/storage/ingest";

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
});
