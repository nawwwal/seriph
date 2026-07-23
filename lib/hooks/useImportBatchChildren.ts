'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { mapImportBatchChildren, type ImportBatchChildren } from '@/lib/imports/mapImportBatch';
import { createImportBatchChildrenController, type ImportBatchChildrenApi, type ImportBatchChildrenListener } from '@/lib/imports/importBatchChildrenController';

export type { ImportBatchChildKind, ImportBatchChildrenRows, ImportBatchChildrenListener, ImportBatchChildrenApi } from '@/lib/imports/importBatchChildrenController';
export { CHILDREN_LOAD_CANCELLED, createImportBatchChildrenController } from '@/lib/imports/importBatchChildrenController';

function firestoreChildrenListener(uid: string): ImportBatchChildrenListener { return { subscribe(batchId, kind, rows, error) { const ref = collection(db, 'users', uid, 'importBatches', batchId, kind); return onSnapshot(query(ref, orderBy('__name__'), limit(100)), (snapshot) => rows(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))), error); } }; }
function childrenApi(user: Pick<User, 'getIdToken'>): ImportBatchChildrenApi { return { async get(batchId) { const token = await user.getIdToken(); const response = await fetch(`/api/v1/import-batches/${encodeURIComponent(batchId)}`, { headers: { Authorization: `Bearer ${token}` } }); const payload = await response.json().catch(() => ({})) as { data?: unknown }; if (!response.ok) throw new Error(`Import batch children failed (${response.status})`); return mapImportBatchChildren(payload.data) ?? { batch: null, familyPlans: [], reviewItems: [], familyPlansCursor: null, reviewItemsCursor: null }; } }; }

export function useImportBatchChildren({ user, isAuthLoading }: { user: User | null; isAuthLoading: boolean }) {
  const [cache, setCache] = useState<{ ownerId: string; children: Record<string, ImportBatchChildren> }>({ ownerId: '', children: {} });
  const controller = useRef<ReturnType<typeof createImportBatchChildrenController> | null>(null); const controllerOwner = useRef('');
  useEffect(() => {
    if (isAuthLoading || !user?.uid) { controller.current?.close(); controller.current = null; controllerOwner.current = ''; return; }
    const next = createImportBatchChildrenController({ listener: firestoreChildrenListener(user.uid), api: childrenApi(user) }); controller.current = next; controllerOwner.current = user.uid;
    return () => { next.close(); if (controller.current === next) { controller.current = null; controllerOwner.current = ''; } };
  }, [isAuthLoading, user]);
  const loadChildren = useCallback(async (batchId: string) => { if (!controller.current || controllerOwner.current !== user?.uid) return { batch: null, familyPlans: [], reviewItems: [], familyPlansCursor: null, reviewItemsCursor: null }; const value = await controller.current.loadChildren(batchId); const ownerId = controllerOwner.current; setCache((previous) => ({ ownerId, children: { ...(previous.ownerId === ownerId ? previous.children : {}), [batchId]: value } })); return value; }, [user?.uid]);
  const refreshChildren = useCallback(async (batchId: string) => { if (!user || isAuthLoading) return { batch: null, familyPlans: [], reviewItems: [], familyPlansCursor: null, reviewItemsCursor: null }; const ownerId = user.uid; const value = await childrenApi(user).get(batchId); setCache((previous) => ({ ownerId, children: { ...(previous.ownerId === ownerId ? previous.children : {}), [batchId]: value } })); return value; }, [isAuthLoading, user]);
  const children = cache.ownerId === user?.uid ? cache.children : {};
  return { children, loadChildren, refreshChildren, collapse: (batchId: string) => controller.current?.collapse(batchId) };
}
