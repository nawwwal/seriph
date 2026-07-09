import { Timestamp } from 'firebase/firestore';
import type { Font, FontFamily } from '@/models/font.models';

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

export function familyResponseError(json: unknown, status: number): Error {
  const maybeError = isRecord(json) ? json.error : null;
  const message = isRecord(maybeError) && typeof maybeError.message === 'string'
    ? maybeError.message
    : `Family request failed: ${status}`;
  return new Error(message);
}

export function familyResponseData(json: unknown): Record<string, unknown> | null {
  const data = isRecord(json) ? json.data : null;
  return isRecord(data) ? data : null;
}
