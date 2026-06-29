import { describe, expect, it } from "vitest";
import {
  buildIntakePath,
  parseIntakePath,
  processingIdFromObjectName,
} from "../../src/ingest/intakePath";

describe("intake path contract", () => {
  it("parses owner-scoped intake paths", () => {
    expect(parseIntakePath("intake/user-1/batch-1/proc-Inter.otf", "intake")).toEqual({
      ownerId: "user-1",
      batchId: "batch-1",
      objectName: "proc-Inter.otf",
      isLegacy: false,
    });
  });

  it("keeps legacy intake paths readable for in-flight objects", () => {
    expect(parseIntakePath("intake/batch-1/proc-Inter.otf", "intake")).toEqual({
      ownerId: null,
      batchId: "batch-1",
      objectName: "proc-Inter.otf",
      isLegacy: true,
    });
  });

  it("extracts processing ids from registered object names", () => {
    expect(processingIdFromObjectName("proc-Inter.otf")).toBe("proc");
    expect(processingIdFromObjectName("Inter.otf")).toBeNull();
  });

  it("builds new owner-scoped intake paths", () => {
    expect(buildIntakePath({
      intakePrefix: "intake",
      ownerId: "user-1",
      batchId: "batch-1",
      objectName: "proc-Inter.otf",
    })).toBe("intake/user-1/batch-1/proc-Inter.otf");
  });
});
