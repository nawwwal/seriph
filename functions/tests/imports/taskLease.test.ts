import { afterEach, describe, expect, it, vi } from "vitest";
import { claimTaskLease, completeTaskLease } from "../../src/imports/tasks/lease";

afterEach(() => vi.unstubAllEnvs());

function fakeLeaseRef(data?: Record<string, unknown>) {
  const tx = {
    get: vi.fn().mockResolvedValue({ exists: data !== undefined, data: () => data }),
    set: vi.fn(),
  };
  const ref = { firestore: { runTransaction: (cb: (tx: typeof tx) => unknown) => cb(tx) } };
  return { ref, tx };
}

describe("durable import task leases", () => {
  it("claims a missing lease and writes exact timestamps", async () => {
    vi.stubEnv("IMPORT_TASK_LEASE_SECONDS", "60");
    const now = new Date("2026-07-18T10:00:00.000Z");
    const missing = fakeLeaseRef();
    expect(await claimTaskLease(missing.ref as never, now)).toEqual({ kind: "claimed", attempt: 1 });
    expect(missing.tx.set).toHaveBeenCalledWith(missing.ref, {
      state: "leased", attempt: 1, leaseStartedAt: now, leaseExpiresAt: new Date("2026-07-18T10:01:00.000Z"),
    }, { merge: true });
  });

  it("reclaims retryable and abandoned leased work at the exact expiry boundary", async () => {
    const now = new Date("2026-07-18T10:00:00.000Z");
    const expired = fakeLeaseRef({ state: "retryable", attempt: 1, leaseExpiresAt: now });
    const abandoned = fakeLeaseRef({ state: "leased", attempt: 2, leaseExpiresAt: now });
    const active = fakeLeaseRef({ state: "leased", attempt: 1, leaseExpiresAt: new Date("2026-07-18T10:01:00.000Z") });
    expect(await claimTaskLease(expired.ref as never, now)).toMatchObject({ kind: "claimed", attempt: 2 });
    expect(await claimTaskLease(abandoned.ref as never, now)).toMatchObject({ kind: "claimed", attempt: 3 });
    expect(await claimTaskLease(active.ref as never, now)).toEqual({ kind: "busy" });
    expect(expired.tx.set).toHaveBeenCalledOnce();
    expect(active.tx.set).not.toHaveBeenCalled();
  });

  it("completes the claimed lease without making it retryable", async () => {
    const now = new Date("2026-07-18T10:00:00.000Z");
    const lease = fakeLeaseRef({ state: "leased", attempt: 2, leaseExpiresAt: new Date("2026-07-18T10:01:00.000Z") });
    await completeTaskLease(lease.ref as never, 2, now);
    expect(lease.tx.set).toHaveBeenCalledWith(lease.ref, {
      state: "complete", completedAt: now, leaseExpiresAt: now,
    }, { merge: true });
  });

  it("does not claim nonretryable leases or reset malformed attempts", async () => {
    const now = new Date("2026-07-18T10:00:00.000Z");
    const terminal = fakeLeaseRef({ state: "complete", attempt: 1, leaseExpiresAt: new Date(0) });
    expect(await claimTaskLease(terminal.ref as never, now)).toEqual({ kind: "busy" });
    for (const attempt of ["2", -1, 1.5, Number.NaN]) {
      const corrupt = fakeLeaseRef({ state: "retryable", attempt, leaseExpiresAt: new Date(0) });
      await expect(claimTaskLease(corrupt.ref as never, now)).rejects.toThrow("attempt");
      expect(corrupt.tx.set).not.toHaveBeenCalled();
    }
  });

  it.each(["", "nope", "Infinity", "1.5", "0", "86401"])
    ("rejects invalid lease duration %s", async (duration) => {
      vi.stubEnv("IMPORT_TASK_LEASE_SECONDS", duration);
      const ref = fakeLeaseRef();
      await expect(claimTaskLease(ref.ref as never, new Date("2026-07-18T10:00:00.000Z"))).rejects.toThrow();
    });

  it("rejects lease expiry overflow", async () => {
    vi.stubEnv("IMPORT_TASK_LEASE_SECONDS", "1");
    const ref = fakeLeaseRef();
    await expect(claimTaskLease(ref.ref as never, new Date(8640000000000000))).rejects.toThrow();
  });
});
