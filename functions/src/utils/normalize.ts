/**
 * Normalize a human-readable name for use in IDs and URLs.
 */
export function normalizeName(name: string): string {
  if (!name) return 'unknown';
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
