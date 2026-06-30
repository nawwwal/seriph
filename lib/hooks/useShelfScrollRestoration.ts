'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import {
  readShelfScrollSnapshot,
  writeShelfScrollSnapshot,
} from '@/lib/shelf/shelfScrollSnapshot';
import { getShelfAnchorSnapshot, restoreShelfAnchor } from '@/lib/shelf/shelfScrollDom';

const RESTORE_TOLERANCE_PX = 32;

export function useShelfScrollRestoration({
  uid,
  scrollRef,
  familyCount,
  hasMore,
  isLoadingMore,
  loadMore,
}: {
  uid: string;
  scrollRef: RefObject<HTMLElement | null>;
  familyCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
}) {
  const restoredSnapshotKey = useRef<string | null>(null);
  const loadMoreRef = useRef(loadMore);
  const saveScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element || familyCount === 0) return;
    writeShelfScrollSnapshot(uid, {
      top: element.scrollTop,
      ...getShelfAnchorSnapshot(element),
      updatedAt: Date.now(),
    });
  }, [familyCount, scrollRef, uid]);

  useLayoutEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    let frame = 0;
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(saveScroll);
    };
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') saveScroll();
    };
    element.addEventListener('scroll', save, { passive: true });
    window.addEventListener('pagehide', saveScroll);
    document.addEventListener('visibilitychange', saveWhenHidden);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('scroll', save);
      window.removeEventListener('pagehide', saveScroll);
      document.removeEventListener('visibilitychange', saveWhenHidden);
      saveScroll();
    };
  }, [saveScroll, scrollRef]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const snapshot = readShelfScrollSnapshot(uid);
    if (!snapshot || familyCount === 0) return;
    const snapshotKey = `${uid}:${snapshot.updatedAt}:${snapshot.top}:${snapshot.anchorFamilyId ?? ''}`;
    if (restoredSnapshotKey.current === snapshotKey) return;

    if (restoreShelfAnchor(element, snapshot)) {
      restoredSnapshotKey.current = snapshotKey;
      return;
    }

    if (snapshot.anchorFamilyId && hasMore) {
      if (!isLoadingMore) void loadMoreRef.current();
      return;
    }

    const maxTop = element.scrollHeight - element.clientHeight;
    const canReachSavedTop = maxTop + RESTORE_TOLERANCE_PX >= snapshot.top;
    if (canReachSavedTop || !hasMore) {
      element.scrollTop = Math.min(snapshot.top, Math.max(0, maxTop));
      restoredSnapshotKey.current = snapshotKey;
      return;
    }
    if (!isLoadingMore) void loadMoreRef.current();
  }, [familyCount, hasMore, isLoadingMore, scrollRef, uid]);

  return saveScroll;
}
