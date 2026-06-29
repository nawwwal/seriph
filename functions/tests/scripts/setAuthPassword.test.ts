import { describe, expect, it } from "vitest";
import { parseSetAuthPasswordArgs, validateSetAuthPasswordArgs } from "../../src/scripts/setAuthPassword";

describe("set auth password helpers", () => {
  it("parses uid, email, password, and dry-run controls", () => {
    expect(parseSetAuthPasswordArgs(["--uid=user-1", "--password=long-enough", "--dryRun"])).toEqual({
      uid: "user-1",
      email: undefined,
      password: "long-enough",
      dryRun: true,
    });

    expect(parseSetAuthPasswordArgs(["--email=ada@seriph.test", "--password=long-enough"])).toEqual({
      uid: undefined,
      email: "ada@seriph.test",
      password: "long-enough",
      dryRun: false,
    });
  });

  it("requires exactly one user lookup target and an eight-character password", () => {
    expect(() => validateSetAuthPasswordArgs(parseSetAuthPasswordArgs(["--password=long-enough"]))).toThrow("Pass exactly one of --uid=<uid> or --email=<email>.");
    expect(() => validateSetAuthPasswordArgs(parseSetAuthPasswordArgs(["--uid=user-1", "--email=ada@seriph.test", "--password=long-enough"]))).toThrow("Pass exactly one of --uid=<uid> or --email=<email>.");
    expect(() => validateSetAuthPasswordArgs(parseSetAuthPasswordArgs(["--uid=user-1", "--password=short"]))).toThrow("Password must be at least 8 characters.");
  });
});
