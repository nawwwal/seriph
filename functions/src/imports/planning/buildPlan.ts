import type { PlannedFontIdentity, PlannedFontInput } from "./identity";
import { resolvePlannedFontIdentity } from "./identity";
import { validatePlan } from "./validatePlan";

const SHA256 = /^[a-f0-9]{64}$/;
export interface PlanInventoryItem extends Partial<PlannedFontInput> {
  id?: string; itemId?: string; ownerId: string; batchId: string; sha256: string;
  detectedFormat?: string; format?: string; version?: string | number; fontVersion?: string | number;
  destination?: string; familyId?: string; identity?: PlannedFontIdentity;
}
export interface PlanItem {
  id: string; itemId: string; sha256: string; action: "apply" | "duplicate" | "review";
  reasonCode: string; familyId: string; logicalFaceKey: string; primaryItemId?: string;
}
export interface PlanAsset { assetId: string; itemId: string; sha256: string; format: string; version: string; }
export interface PlanFace {
  logicalFaceKey: string; styleName: string; weight: number; width: number; italic: boolean; assets: PlanAsset[];
}
export interface PlanFamily { familyId: string; familyName: string; familySlug: string; faces: PlanFace[]; clean: boolean; }
export interface ReviewItem { itemId: string; reasonCode: string; detail: string; }
export interface ImportPlan {
  ownerId: string; batchId: string; planVersion: number; state: "validated";
  items: PlanItem[]; families: PlanFamily[]; reviewItems: ReviewItem[]; contentHash?: string;
}
interface Candidate { input: PlanInventoryItem; identity: PlannedFontIdentity; id: string; format: string; version: string; familyId: string; }
const itemId = (input: PlanInventoryItem): string => input.itemId ?? input.id ?? "";
const format = (input: PlanInventoryItem, identity: PlannedFontIdentity): string =>
  (input.detectedFormat ?? input.format ?? identity.containerFormat).replace(/^\./, "").toUpperCase();
const version = (input: PlanInventoryItem): string => String(input.version ?? input.fontVersion ?? "unknown").trim().toLowerCase() || "unknown";
function candidate(input: PlanInventoryItem): Candidate {
  const id = itemId(input); if (!id) throw new Error("plan item id required");
  const identity = input.identity ?? resolvePlannedFontIdentity(input as PlannedFontInput);
  return { input, identity, id, format: format(input, identity), version: version(input), familyId: input.familyId ?? identity.familyKey };
}
function addReview(reviews: ReviewItem[], item: PlanItem, reasonCode: string, detail: string): void {
  if (item.action !== "review") item.action = "review";
  if (item.reasonCode === "planned" || item.reasonCode === "duplicate_content") item.reasonCode = reasonCode;
  if (!reviews.some((entry) => entry.itemId === item.id)) reviews.push({ itemId: item.id, reasonCode: item.reasonCode, detail });
}
export function buildImportPlan(inputs: readonly PlanInventoryItem[], planVersion = 1): ImportPlan {
  const candidates = inputs.map(candidate).sort((a, b) => a.id.localeCompare(b.id));
  const items = candidates.map((entry): PlanItem => ({ id: entry.id, itemId: entry.id, sha256: entry.input.sha256, action: "apply", reasonCode: "planned", familyId: entry.familyId, logicalFaceKey: entry.identity.logicalFaceKey }));
  const byKey = new Map<string, Candidate[]>();
  candidates.forEach((entry) => { const key = `${entry.familyId}\0${entry.identity.logicalFaceKey}`; byKey.set(key, [...(byKey.get(key) ?? []), entry]); });
  const reviews: ReviewItem[] = [];
  const itemFor = (id: string) => items.find((entry) => entry.id === id)!;
  const hashes = new Map<string, Candidate[]>();
  candidates.forEach((entry) => {
    if (SHA256.test(entry.input.sha256)) hashes.set(entry.input.sha256, [...(hashes.get(entry.input.sha256) ?? []), entry]);
    else addReview(reviews, itemFor(entry.id), "invalid_sha256", "Only exact lowercase SHA-256 claims are accepted");
  });
  for (const sameBytes of hashes.values()) {
    sameBytes.sort((a, b) => a.id.localeCompare(b.id));
    const primary = sameBytes[0]!;
    sameBytes.slice(1).forEach((entry) => {
      const planItem = itemFor(entry.id);
      planItem.primaryItemId = primary.id;
      if (entry.familyId === primary.familyId) { planItem.action = "duplicate"; planItem.reasonCode = "duplicate_content"; }
      else addReview(reviews, planItem, "cross_family_duplicate", `Exact bytes reference primary ${primary.id} in another family`);
    });
  }
  for (const group of byKey.values()) {
    const eligible = group.filter((entry) => itemFor(entry.id).action === "apply");
    const byFormatVersion = new Map<string, Candidate[]>();
    eligible.forEach((entry) => { const key = `${entry.format}\0${entry.version}`; byFormatVersion.set(key, [...(byFormatVersion.get(key) ?? []), entry]); });
    for (const conflict of byFormatVersion.values()) if (new Set(conflict.map((entry) => entry.input.sha256)).size > 1) conflict.forEach((entry) => addReview(reviews, itemFor(entry.id), "same_format_version_conflict", `${entry.format} ${entry.version} has different bytes`));
  }
  const destinations = new Map<string, Candidate[]>();
  candidates.filter((entry) => entry.input.destination).forEach((entry) => { const key = entry.input.destination!.toLocaleLowerCase(); destinations.set(key, [...(destinations.get(key) ?? []), entry]); });
  for (const collision of destinations.values()) if (collision.length > 1) collision.forEach((entry) => addReview(reviews, itemFor(entry.id), "destination_collision", "Destination collides case-insensitively"));
  candidates.filter((entry) => entry.format === "EOT").forEach((entry) => addReview(reviews, itemFor(entry.id), "eot_unsupported", "EOT cannot produce a served asset"));
  const families = [...byKey.entries()].reduce<PlanFamily[]>((result, [key, group]) => {
    const first = group[0]!; const [familyId] = key.split("\0"); const family = result.find((entry) => entry.familyId === familyId);
    const assets = group.filter((entry) => itemFor(entry.id).action === "apply").map((entry) => ({ assetId: `${entry.id}-${entry.input.sha256.slice(0, 12)}`, itemId: entry.id, sha256: entry.input.sha256, format: entry.format, version: entry.version }));
    const face = { logicalFaceKey: first.identity.logicalFaceKey, styleName: first.identity.styleName, weight: first.identity.weight, width: first.identity.width, italic: first.identity.italic, assets };
    if (family) family.faces.push(face); else result.push({ familyId, familyName: first.identity.familyName, familySlug: first.identity.familySlug, faces: [face], clean: true });
    return result;
  }, []).sort((a, b) => a.familyId.localeCompare(b.familyId));
  families.forEach((family) => { family.faces.sort((a, b) => a.logicalFaceKey.localeCompare(b.logicalFaceKey)); family.clean = !items.some((entry) => entry.familyId === family.familyId && entry.action === "review"); });
  const ownerId = inputs[0]?.ownerId ?? ""; const batchId = inputs[0]?.batchId ?? "";
  if (new Set(items.map((entry) => entry.id)).size !== items.length) throw new Error("plan item IDs must be unique");
  return validatePlan({ ownerId, batchId, planVersion, state: "validated", items: items.sort((a, b) => a.id.localeCompare(b.id)), families, reviewItems: reviews.sort((a, b) => a.itemId.localeCompare(b.itemId)) });
}
