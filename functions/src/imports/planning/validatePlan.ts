import { createHash } from "crypto";
import type { ImportPlan } from "./buildPlan";

const SHA256 = /^[a-f0-9]{64}$/;
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])]));
}
export function planPayload(plan: ImportPlan): string {
  const { contentHash: _contentHash, ...payload } = plan;
  return JSON.stringify(ordered(payload));
}
export function planContentHash(plan: ImportPlan): string {
  return createHash("sha256").update(planPayload(plan)).digest("hex");
}
function freeze<T>(value: T): T {
  if (isObject(value) || Array.isArray(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export function validatePlan(plan: ImportPlan): ImportPlan {
  if (!Number.isSafeInteger(plan.planVersion) || plan.planVersion < 1) throw new Error("planVersion must be positive");
  if (!plan.ownerId || !plan.batchId || plan.state !== "validated") throw new Error("validated plan identity/state required");
  for (const item of plan.items) {
    if ((item.action === "apply" || item.action === "duplicate") && !SHA256.test(item.sha256)) throw new Error("plan contains non-exact SHA-256");
  }
  const contentHash = planContentHash(plan);
  if (plan.contentHash && plan.contentHash !== contentHash) throw new Error("plan content hash mismatch");
  return freeze({ ...plan, contentHash });
}
export const validateImportPlan = validatePlan;
