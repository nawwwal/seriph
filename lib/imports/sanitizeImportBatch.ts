type PublicRecord = Record<string, unknown>;

const PRIVATE_FIELD = /^(source|storage|private|url|.*(?:path|url|token|secret|credential))$/i;

const isRecord = (value: unknown): value is PublicRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function sanitizePublicImportValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizePublicImportValue);
  if (!isRecord(value)) return typeof value === 'function' ? undefined : value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE_FIELD.test(key)).map(([key, item]) => [key, sanitizePublicImportValue(item)]).filter(([, item]) => item !== undefined));
}
