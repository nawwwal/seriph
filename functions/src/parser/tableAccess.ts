export type LooseRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function recordAt(record: LooseRecord, key: string): LooseRecord | undefined {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

export function numberAt(record: LooseRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

export function stringAt(record: LooseRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

export function firstString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return undefined;
  const english = value.en;
  if (typeof english === "string") return english;
  return Object.values(value).find((item): item is string => typeof item === "string");
}
