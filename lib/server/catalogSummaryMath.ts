import type { ShelfStatsSummary } from '@/models/shelf.models';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function time(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (!isRecord(value)) return 0;
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
}

function styles(data: Record<string, unknown>): number {
  if (typeof data.styleCount === 'number') return data.styleCount;
  return Array.isArray(data.faces) ? data.faces.length : 0;
}

export function summarizeCatalogFamilies(docs: Record<string, unknown>[], now: string): ShelfStatsSummary {
  let familyCount = 0;
  let styleCount = 0;
  let recentFamilyName: string | null = null;
  let recentTime = 0;
  for (const data of docs) {
    if (data.hidden === true) continue;
    familyCount += 1;
    styleCount += styles(data);
    const createdAt = time(data.createdAt);
    if (createdAt >= recentTime) {
      recentTime = createdAt;
      recentFamilyName = typeof data.name === 'string' ? data.name : null;
    }
  }
  return { familyCount, styleCount, recentFamilyName, generatedAt: now, libraryRevision: 1, updatedAt: now };
}
