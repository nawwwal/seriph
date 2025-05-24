/**
 * Normalizes a name for use as an ID or for comparison.
 * Converts to lowercase and replaces spaces and special characters with hyphens.
 * Removes duplicate hyphens.
 */
export function normalizeName(name: string): string {
  if (!name) return 'unknown';
  return name
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove special characters except hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with a single one
    .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
}
