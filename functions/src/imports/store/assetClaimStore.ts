import type { Firestore } from "firebase-admin/firestore";
import { importBatchRef } from "./paths";

const SHA256 = /^[a-f0-9]{64}$/;
const DEFAULT_LEASE_MS = 15 * 60 * 1000;
export interface FirestoreTimestampLike { seconds?: number; nanoseconds?: number; toDate?: () => Date; }

export interface AssetClaimInput {
  ownerId: string; batchId: string; itemId: string; sha256: string;
  familyId: string; logicalFaceKey: string; assetId: string; claimId?: string;
}
export type AssetClaimResult =
  | { kind: "claimed"; leaseExpiresAt: Date }
  | { kind: "committed_duplicate"; familyId: string; logicalFaceKey: string; assetId: string }
  | { kind: "canceled" }
  | { kind: "busy"; retryAt: Date };
export type CommitClaimResult = { kind: "committed" } | { kind: "committed_duplicate" } | { kind: "not_claimed" };

const segment = (value: string, name: string): string => {
  if (!value || value.includes("/")) throw new Error(`invalid ${name}`);
  return value;
};
const claimId = (input: AssetClaimInput): string => input.claimId ?? `${input.batchId}:${input.itemId}`;
const checkSha = (sha256: string): string => {
  if (!SHA256.test(sha256)) throw new Error("sha256 must be an exact lowercase SHA-256 digest");
  return sha256;
};
export function leaseDate(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (!value || typeof value !== "object") return undefined;
  const timestamp = value as FirestoreTimestampLike;
  if (typeof timestamp.toDate === "function") return leaseDate(timestamp.toDate());
  if (typeof timestamp.seconds === "number") {
    const date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds ?? 0) / 1e6);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}
export const assetClaimRef = (db: Firestore, ownerId: string, sha256: string) =>
  db.collection("users").doc(segment(ownerId, "ownerId")).collection("assetClaims").doc(checkSha(sha256));

export async function claimAsset(
  db: Firestore, input: AssetClaimInput, now = new Date(), leaseMs = DEFAULT_LEASE_MS,
): Promise<AssetClaimResult> {
  const sha256 = checkSha(input.sha256);
  const holder = claimId(input);
  return db.runTransaction(async (tx) => {
    const ref = assetClaimRef(db, input.ownerId, sha256);
    const snap = await tx.get(ref);
    const batch = await tx.get(importBatchRef(db, input.ownerId, input.batchId));
    if (batch.exists && batch.data()?.outcome === "canceled") return { kind: "canceled" };
    const current = snap.exists ? snap.data() as Record<string, any> : undefined;
    if (current?.status === "committed") return {
      kind: "committed_duplicate", familyId: current.familyId, logicalFaceKey: current.logicalFaceKey, assetId: current.assetId,
    };
    const expires = leaseDate(current?.leaseExpiresAt);
    if (expires && expires > now && current?.claimId !== holder) return { kind: "busy", retryAt: expires };
    const leaseExpiresAt = expires && expires > now ? expires : new Date(now.getTime() + leaseMs);
    tx.set(ref, { ...input, sha256, claimId: holder, status: "leased", leaseExpiresAt, updatedAt: now });
    return { kind: "claimed", leaseExpiresAt };
  });
}

export async function commitAssetClaim(
  db: Firestore, input: AssetClaimInput, now = new Date(),
): Promise<CommitClaimResult> {
  const sha256 = checkSha(input.sha256);
  return db.runTransaction(async (tx) => {
    const ref = assetClaimRef(db, input.ownerId, sha256);
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() as Record<string, any> : undefined;
    if (current?.status === "committed") return { kind: "committed_duplicate" };
    if (!current) return { kind: "not_claimed" };
    const expires = leaseDate(current.leaseExpiresAt);
    if (current.claimId !== claimId(input) || !expires || expires <= now) return { kind: "not_claimed" };
    tx.set(ref, { ...current, status: "committed", updatedAt: now });
    return { kind: "committed" };
  });
}

export const claimIdenticalAsset = claimAsset;
