/**
 * Normalize a human-readable name for use in IDs and URLs.
 * - Lowercase
 * - Replace whitespace with hyphens
 * - Remove non-alphanumeric (keep hyphens)
 * - Collapse and trim hyphens
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
