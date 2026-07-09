export function parseSearchIndexRevision(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const revision = Number(value);
  return Number.isSafeInteger(revision) ? revision : undefined;
}
