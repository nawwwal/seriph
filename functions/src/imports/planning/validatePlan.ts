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
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export function validatePlan(plan: ImportPlan): ImportPlan {
  requireValue(Number.isSafeInteger(plan.planVersion) && plan.planVersion >= 1, "planVersion must be positive");
  requireValue(Boolean(plan.ownerId) && Boolean(plan.batchId) && plan.state === "validated", "validated plan identity/state required");
  requireValue(Array.isArray(plan.items) && Array.isArray(plan.families) && Array.isArray(plan.reviewItems), "plan collections required");
  const items = new Map<string, any>();
  for (const item of plan.items) {
    requireValue(item && typeof item.id === "string" && item.id === item.itemId && !items.has(item.id), "plan item IDs must be unique");
    requireValue(typeof item.familyId === "string" && typeof item.logicalFaceKey === "string", "plan item family identity required");
    requireValue(item.action === "apply" || item.action === "duplicate" || item.action === "review", "unknown plan item action");
    requireValue(Array.isArray(item.reasonCodes) && new Set(item.reasonCodes).size === item.reasonCodes.length, "plan reason list invalid");
    if (item.action === "apply") requireValue(item.reasonCodes.length === 0 && item.reasonCode === "planned" && item.primaryItemId === undefined, "apply item semantics invalid");
    if (item.action === "duplicate") requireValue(typeof item.primaryItemId === "string" && item.reasonCodes.includes("duplicate_content"), "duplicate primary reference required");
    if (item.action === "review") requireValue(item.reasonCodes.length > 0, "review reasons required");
    requireValue(SHA256.test(item.sha256) || (item.action === "review" && item.reasonCode === "invalid_sha256"), "plan contains non-exact SHA-256");
    items.set(item.id, item);
  }
  const reviewIds = new Set<string>();
  for (const review of plan.reviewItems) {
    const item = items.get(review.itemId);
    requireValue(item && item.action === "review" && item.reasonCode === review.reasonCode && Array.isArray(review.reasonCodes) && JSON.stringify(review.reasonCodes) === JSON.stringify(item.reasonCodes) && Array.isArray(review.details) && !reviewIds.has(review.itemId), "review item consistency failed");
    reviewIds.add(review.itemId);
  }
  for (const item of plan.items.filter((entry) => entry.action === "review")) requireValue(reviewIds.has(item.id), "review item missing decision");
  for (const item of plan.items.filter((entry) => entry.primaryItemId !== undefined)) {
    const primary = item.primaryItemId ? items.get(item.primaryItemId) : undefined;
    requireValue(primary && (primary.action === "apply" || primary.action === "review") && primary.primaryItemId === undefined && primary.id !== item.id && primary.sha256 === item.sha256, "duplicate primary reference invalid");
    if (item.action === "duplicate") requireValue(primary.familyId === item.familyId && item.reasonCodes.includes("duplicate_content"), "same-family duplicate reference invalid");
    if (item.action === "review") requireValue(primary.familyId !== item.familyId && item.reasonCodes.includes("cross_family_duplicate"), "cross-family duplicate reference invalid");
  }
  const families = new Map<string, any>(); const assets = new Map<string, string>();
  for (const family of plan.families) {
    requireValue(family && typeof family.familyId === "string" && !families.has(family.familyId) && Array.isArray(family.faces), "family structure invalid");
    families.set(family.familyId, family); const faces = new Set<string>();
    for (const face of family.faces) {
      requireValue(face && typeof face.logicalFaceKey === "string" && !faces.has(face.logicalFaceKey) && Array.isArray(face.assets), "face structure invalid");
      faces.add(face.logicalFaceKey);
      for (const asset of face.assets) {
        const item = items.get(asset.itemId);
        requireValue(item && item.action === "apply" && item.familyId === family.familyId && item.logicalFaceKey === face.logicalFaceKey, "family asset consistency failed");
        requireValue(SHA256.test(asset.sha256) && asset.sha256 === item.sha256 && typeof asset.assetId === "string" && !assets.has(asset.assetId), "asset structure invalid");
        assets.set(asset.assetId, asset.itemId);
      }
    }
    const expectedClean = !plan.items.some((item) => item.familyId === family.familyId && item.action === "review");
    requireValue(family.clean === expectedClean, "family clean state invalid");
  }
  for (const item of plan.items) requireValue(families.has(item.familyId), "item family missing");
  const applyIds = new Set([...assets.values()]);
  for (const item of plan.items) requireValue(item.action === "apply" ? applyIds.has(item.id) : !applyIds.has(item.id), "apply asset membership invalid");
  const contentHash = planContentHash(plan);
  if (plan.contentHash && plan.contentHash !== contentHash) throw new Error("plan content hash mismatch");
  const copy = JSON.parse(JSON.stringify({ ...plan, contentHash })) as ImportPlan;
  return freeze(copy);
}
export const validateImportPlan = validatePlan;
