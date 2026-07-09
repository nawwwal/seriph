import type { Dispatch, SetStateAction } from 'react';
import type { ShelfStatsSummary } from '@/models/shelf.models';
import { writeShelfFamilyCache } from '@/lib/shelf/familyPageCache';
import { pageFromInfiniteState, type InfiniteFamiliesState } from '@/lib/hooks/infiniteFamiliesState';

export function synchronizeShelfStats(
  uid: string,
  stats: ShelfStatsSummary,
  setState: Dispatch<SetStateAction<InfiniteFamiliesState>>
): void {
  setState((current) => {
    writeShelfFamilyCache(uid, { ...pageFromInfiniteState(current), stats });
    return { ...current, stats };
  });
}
