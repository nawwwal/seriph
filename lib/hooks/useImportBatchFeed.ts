'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { createImportBatchApi, createFirestoreBatchFeedListener } from '@/lib/imports/importBatchFeedAdapters';
import { createBatchFeedController, type BatchFeedApi, type BatchFeedListener, type BatchFeedState } from '@/lib/imports/importBatchFeedController';
import type { FamiliesAppliedEvent } from '@/lib/imports/mapImportBatch';

export type { BatchFeedApi, BatchFeedListener, BatchFeedState } from '@/lib/imports/importBatchFeedController';
export { createBatchFeedController } from '@/lib/imports/importBatchFeedController';
export { appliedFamilyCount } from '@/lib/imports/mapImportBatch';
export type { BatchFeedPage, BatchFeedRows, BatchFeedError, Unsubscribe } from '@/lib/imports/importBatchFeedController';

export function useImportBatchFeed({ user, isAuthLoading, onCompletion, listener, api }: { user: User | null; isAuthLoading: boolean; onCompletion?: (event: FamiliesAppliedEvent) => void; listener?: BatchFeedListener; api?: BatchFeedApi }) {
  const empty: BatchFeedState = { batches: [], activeCount: 0, transport: 'realtime', nextCursor: null };
  const [ownedFeed, setOwnedFeed] = useState<{ ownerId: string; feed: BatchFeedState }>({ ownerId: '', feed: empty });
  const controller = useRef<ReturnType<typeof createBatchFeedController> | null>(null);
  const loadOlder = useCallback(async () => { await controller.current?.loadOlder(); }, []);
  useEffect(() => {
    if (isAuthLoading || !user?.uid) return;
    const ownerId = user.uid; const next = createBatchFeedController({ listener: listener ?? createFirestoreBatchFeedListener(ownerId), api: api ?? createImportBatchApi(user), onChange: (feed) => setOwnedFeed({ ownerId, feed }), onCompletion }); controller.current = next; next.start();
    return () => { next.stop(); if (controller.current === next) controller.current = null; };
  }, [api, isAuthLoading, listener, onCompletion, user]);
  const feed = ownedFeed.ownerId === user?.uid ? ownedFeed.feed : empty;
  return { ...feed, loadOlder };
}
