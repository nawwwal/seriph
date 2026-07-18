import type { FontFamilyDoc } from "../models/catalog.models";

export type FamilyPreflightResult =
  | { kind: "accepted" }
  | { kind: "rejected"; code: "invalid_family" | "alias"; reasons: string[] };
type RenderFamily = (family: FontFamilyDoc) => Promise<Buffer | null>;
export type RejectedFamily = { family: FontFamilyDoc; code: string; reasons: string[]; message?: string; stack?: string };
export type SubmissionCandidates = { accepted: Array<{ family: FontFamilyDoc; png: Buffer | null }>; rejected: RejectedFamily[] };

export function preflightFamily(family: FontFamilyDoc): FamilyPreflightResult {
  if (family.hidden || family.mergedInto || family.aliasOf) {
    return { kind: "rejected", code: "alias", reasons: ["non_canonical"] };
  }
  const reasons = [
    !family.ownerId ? "missing_owner" : null,
    !Array.isArray(family.faces) || family.faces.length === 0 ? "missing_faces" : null,
  ].filter((value): value is string => value !== null);
  return reasons.length ? { kind: "rejected", code: "invalid_family", reasons } : { kind: "accepted" };
}

function errorDetails(error: unknown): Pick<RejectedFamily, "message" | "stack"> {
  return error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
}

export async function buildSubmissionCandidates(
  families: FontFamilyDoc[], render: RenderFamily
): Promise<SubmissionCandidates> {
  const accepted: SubmissionCandidates["accepted"] = [];
  const rejected: RejectedFamily[] = [];
  for (const family of families) {
    const preflight = preflightFamily(family);
    if (preflight.kind === "rejected") rejected.push({ family, ...preflight });
    else try { accepted.push({ family, png: await render(family) }); }
    catch (error) { rejected.push({ family, code: "specimen_failed", reasons: ["specimen_render_failed"], ...errorDetails(error) }); }
  }
  return { accepted, rejected };
}
