export type CatalogRecord = Record<string, unknown>;

export function asRecord(value: unknown): CatalogRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as CatalogRecord
    : null;
}

export function text(record: CatalogRecord, key: string): string | undefined {
  return typeof record[key] === 'string' ? record[key] : undefined;
}

export function number(record: CatalogRecord, key: string, fallback = 0): number {
  return typeof record[key] === 'number' ? record[key] : fallback;
}

export function textArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
}

export function toIso(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const record = asRecord(value);
  if (typeof record?.toDate === 'function') {
    return (record.toDate as () => Date)().toISOString();
  }
  if (typeof record?.seconds === 'number') {
    return new Date(record.seconds * 1000).toISOString();
  }
  return '';
}
