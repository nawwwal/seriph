'use client';

const SCROLL_KEY = 'seriphShelfScroll_v2';

export interface ShelfScrollSnapshot {
  top: number;
  anchorFamilyId: string | null;
  anchorOffset: number;
  updatedAt: number;
}

function keyForUser(uid: string): string {
  return `${SCROLL_KEY}_${uid}`;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTop(value: number): number {
  return Math.max(0, Math.round(value));
}

export function parseShelfScrollSnapshot(raw: string | null): ShelfScrollSnapshot | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const top = finiteNumber(parsed.top);
    const anchorOffset = finiteNumber(parsed.anchorOffset);
    const updatedAt = finiteNumber(parsed.updatedAt);
    if (top === null || anchorOffset === null || updatedAt === null) return null;
    return {
      top: normalizeTop(top),
      anchorFamilyId: stringOrNull(parsed.anchorFamilyId),
      anchorOffset: Math.round(anchorOffset),
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function serializeShelfScrollSnapshot(snapshot: ShelfScrollSnapshot): string {
  return JSON.stringify({
    top: normalizeTop(snapshot.top),
    anchorFamilyId: snapshot.anchorFamilyId,
    anchorOffset: Math.round(snapshot.anchorOffset),
    updatedAt: snapshot.updatedAt,
  });
}

export function readShelfScrollSnapshot(uid: string): ShelfScrollSnapshot | null {
  try {
    return parseShelfScrollSnapshot(sessionStorage.getItem(keyForUser(uid)));
  } catch {
    return null;
  }
}

export function writeShelfScrollSnapshot(uid: string, snapshot: ShelfScrollSnapshot): void {
  try {
    sessionStorage.setItem(keyForUser(uid), serializeShelfScrollSnapshot(snapshot));
  } catch {
    /* Session storage can be disabled; browser history remains the fallback. */
  }
}
