import { describe, expect, it } from "vitest";
import {
  BETA_ALLOWLIST_SEED,
  isEmailInAllowlist,
  normalizeBetaEmail,
} from "../../src/auth/betaAllowlist";
import {
  parseManageBetaArgs,
  validateManageBetaArgs,
} from "../../src/scripts/manageBetaAllowlist";

describe("beta email allowlist helpers", () => {
  it("normalizes email case and whitespace", () => {
    expect(normalizeBetaEmail("  HeroPopat46@Gmail.COM ")).toBe(
      "heropopat46@gmail.com"
    );
  });

  it("checks against an in-memory set", () => {
    const allowed = new Set(BETA_ALLOWLIST_SEED.map((e) => e.toLowerCase()));
    expect(isEmailInAllowlist("heropopat46@gmail.com", allowed)).toBe(true);
    expect(isEmailInAllowlist("HEROPOPAT46@GMAIL.COM", allowed)).toBe(true);
    expect(isEmailInAllowlist("stranger@example.com", allowed)).toBe(false);
    expect(isEmailInAllowlist("", allowed)).toBe(false);
  });

  it("parses manage CLI flags", () => {
    expect(parseManageBetaArgs(["--list"])).toMatchObject({ list: true });
    expect(parseManageBetaArgs(["--add=A@B.com"])).toMatchObject({
      add: "A@B.com",
    });
    expect(parseManageBetaArgs(["--remove=a@b.com", "--dryRun"])).toMatchObject({
      remove: "a@b.com",
      dryRun: true,
    });
  });

  it("requires exactly one manage action", () => {
    expect(() => validateManageBetaArgs(parseManageBetaArgs([]))).toThrow(
      /exactly one/
    );
    expect(() =>
      validateManageBetaArgs(parseManageBetaArgs(["--list", "--seed"]))
    ).toThrow(/exactly one/);
  });
});
