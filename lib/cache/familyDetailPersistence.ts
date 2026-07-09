import type { FontFamily } from '@/models/font.models';
import { readSnapshot, writeSnapshot } from '@/lib/cache/persistentSnapshots';
import { serializeFamilyDetail } from '@/lib/cache/familyDetailSerialization';

const DETAIL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function readPersistedFamilyDetail(
  uid: string,
  familyId: string
): Promise<FontFamily | null> {
  const record = await readSnapshot({ accountId: uid, kind: 'family-detail', key: familyId });
  return record ? serializeFamilyDetail(record.payload) : null;
}

export function persistFamilyDetail(uid: string, familyId: string, family: FontFamily): void {
  void writeSnapshot({
    accountId: uid,
    kind: 'family-detail',
    key: familyId,
    payload: family,
    ttlMs: DETAIL_TTL_MS,
    maxEntries: 24,
  });
}
