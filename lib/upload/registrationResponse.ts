export interface RegistrationResult {
  error?: string;
  ingestId?: string;
  originalName: string;
  storagePath?: string;
  success: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function toRegistration(value: unknown): RegistrationResult | null {
  const record = asRecord(value);
  if (!record || typeof record.originalName !== 'string' || typeof record.success !== 'boolean') {
    return null;
  }
  return {
    originalName: record.originalName,
    success: record.success,
    error: typeof record.error === 'string' ? record.error : undefined,
    ingestId: typeof record.ingestId === 'string' ? record.ingestId : undefined,
    storagePath: typeof record.storagePath === 'string' ? record.storagePath : undefined,
  };
}

export function findRegistration(data: unknown, originalName: string): RegistrationResult | undefined {
  const envelope = asRecord(data);
  const payload = asRecord(envelope?.data);
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.map(toRegistration).find((result) => result?.originalName === originalName) ?? undefined;
}
