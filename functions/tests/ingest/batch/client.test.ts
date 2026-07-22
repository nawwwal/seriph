import { describe, expect, it, vi } from "vitest";

const { GoogleGenAIMock } = vi.hoisted(() => ({ GoogleGenAIMock: vi.fn() }));
vi.mock("@google/genai", () => ({ GoogleGenAI: GoogleGenAIMock }));

import { analysisModelId, batchClient, batchGenerationConfig } from "../../../src/ingest/batch/client";

describe("Gemini batch request defaults", () => {
  it("uses the stable import model and minimal thinking without deprecated sampling fields", () => {
    expect(analysisModelId()).toBe("gemini-3.5-flash-lite");
    const config = batchGenerationConfig();
    expect(config).toMatchObject({
      maxOutputTokens: 1536,
      thinkingConfig: { thinkingLevel: "minimal" },
      responseMimeType: "application/json",
    });
    expect(config).not.toHaveProperty("temperature");
    expect(config).not.toHaveProperty("topP");
    expect(config).not.toHaveProperty("topK");
  });

  it("pins the Vertex client to the stable v1 API", () => {
    batchClient();
    expect(GoogleGenAIMock).toHaveBeenCalledWith({
      vertexai: true,
      project: "seriph",
      location: "global",
      apiVersion: "v1",
    });
  });
});
