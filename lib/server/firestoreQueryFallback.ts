import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

export function isFirestoreIndexUnavailable(error: unknown): boolean {
  const record = error as { code?: unknown; details?: unknown; message?: unknown };
  if (record.code !== 9) return false;
  const text = String(record.details ?? record.message ?? '');
  return text.includes('requires an index');
}

export function sortCatalogDocsByName(docs: QueryDocumentSnapshot[]): QueryDocumentSnapshot[] {
  return [...docs].sort((left, right) => {
    const leftName = typeof left.get('name') === 'string' ? left.get('name') : left.id;
    const rightName = typeof right.get('name') === 'string' ? right.get('name') : right.id;
    return leftName.localeCompare(rightName) || left.id.localeCompare(right.id);
  });
}
