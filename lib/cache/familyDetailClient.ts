'use client';

import { Timestamp } from 'firebase/firestore';
import type { Font, FontFamily } from '@/models/font.models';
import { cacheFamily, cacheFamilyById, getCachedFamily } from '@/lib/cache/familyCache';

type TokenGetter = () => Promise<string>;

interface LoadFamilyDetailInput {
  uid: string;
  familyId: string;
  getIdToken: TokenGetter;
}

const inFlightFamilies = new Map<string, Promise<FontFamily | null>>();

function cacheKey(uid: string, familyId: string): string {
  return `${uid}:${familyId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof (value as { toDate?: unknown } | null)?.toDate === 'function') {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  return typeof value === 'string' ? value : String(value ?? '');
}

function cloneFont(value: unknown): Font | null {
  return isRecord(value) ? ({ ...value } as unknown as Font) : null;
}

export function serializeFamilyDetail(raw: unknown): FontFamily | null {
  if (!isRecord(raw)) return null;
  const fonts = Array.isArray(raw.fonts) ? raw.fonts.map(cloneFont).filter((font) => font !== null) : [];
  return {
    ...raw,
    uploadDate: toIso(raw.uploadDate),
    lastModified: toIso(raw.lastModified),
    fonts,
  } as FontFamily;
}

function responseError(json: unknown, status: number): Error {
  const maybeError = isRecord(json) ? json.error : null;
  const message = isRecord(maybeError) && typeof maybeError.message === 'string'
    ? maybeError.message
    : `Family request failed: ${status}`;
  return new Error(message);
}

async function requestFamilyDetail(input: LoadFamilyDetailInput): Promise<FontFamily | null> {
  const token = await input.getIdToken();
  const response = await fetch(`/api/v1/families/${encodeURIComponent(input.familyId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json: unknown = await response.json();
  if (!response.ok) throw responseError(json, response.status);
  const data = isRecord(json) ? json.data : null;
  return serializeFamilyDetail(isRecord(data) ? data.family : null);
}

export function loadFamilyDetail(input: LoadFamilyDetailInput): Promise<FontFamily | null> {
  const cached = getCachedFamily(input.uid, input.familyId);
  if (cached) return Promise.resolve(cached);

  const key = cacheKey(input.uid, input.familyId);
  const existing = inFlightFamilies.get(key);
  if (existing) return existing;

  const pending = requestFamilyDetail(input)
    .then((family) => {
      if (family) {
        cacheFamily(input.uid, family);
        cacheFamilyById(input.uid, input.familyId, family);
      }
      return family;
    })
    .finally(() => {
      inFlightFamilies.delete(key);
    });
  inFlightFamilies.set(key, pending);
  return pending;
}

export async function prefetchFamilyDetail(input: LoadFamilyDetailInput): Promise<void> {
  try {
    await loadFamilyDetail(input);
  } catch {
    /* Intent prefetch is opportunistic; normal navigation still reports errors. */
  }
}
