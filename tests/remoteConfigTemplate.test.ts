import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { validateTemplate } = require("../scripts/remote-config-template.cjs") as {
  validateTemplate: (remoteConfig: { validateTemplate: (template: unknown) => Promise<unknown> }, template: unknown, updated: number) => Promise<void>;
};

describe("Remote Config setup", () => {
  it("waits for template validation to finish", async () => {
    let release!: () => void;
    const validation = new Promise<void>((resolve) => { release = resolve; });
    const events: string[] = [];
    const remoteConfig = {
      validateTemplate: async () => {
        events.push("started");
        await validation;
        events.push("finished");
        return {};
      },
    };

    const pending = validateTemplate(remoteConfig, {}, 1);
    expect(pending).toBeInstanceOf(Promise);
    await Promise.resolve();
    expect(events).toEqual(["started"]);

    release();
    await pending;
    expect(events).toEqual(["started", "finished"]);
  });
});
