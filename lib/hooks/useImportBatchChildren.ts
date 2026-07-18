'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { mapImportBatchChildren, type ImportBatchChild, type ImportBatchChildren } from '@/lib/imports/mapImportBatch';

export type ImportBatchChildKind = 'familyPlans' | 'reviewItems';
export type ImportBatchChildrenRows = (rows: unknown[]) => void;

export interface ImportBatchChildrenListener {
  subscribe(batchId: string, kind: ImportBatchChildKind, rows: ImportBatchChildrenRows, error: (error: unknown) => void): () => void;
}

export interface ImportBatchChildrenApi {
  get(batchId: string): Promise<ImportBatchChildren>;
}

interface ChildrenControllerOptions {
  listener: ImportBatchChildrenListener;
  api?: ImportBatchChildrenApi;
}

const emptyChildren = (): ImportBatchChildren => ({ batch: null, familyPlans: [], reviewItems: [], familyPlansCursor: null, reviewItemsCursor: null });

export function createImportBatchChildrenController({ listener, api }: ChildrenControllerOptions) {
  let expandedBatchId: string | null = null;
  let stops: Array<() => void> = [];
  let result = emptyChildren();
  let resolvePending: ((children: ImportBatchChildren) => void) | null = null;
  let seen = new Set<ImportBatchChildKind>();

  const collapse = (batchId?: string) => {
    if (batchId && expandedBatchId !== batchId) return;
    stops.forEach((stop) => stop());
    stops = [];
    expandedBatchId = null;
    resolvePending = null;
    seen = new Set();
  };

  const loadChildren = (batchId: string): Promise<ImportBatchChildren> => {
    if (expandedBatchId === batchId && seen.size === 2) return Promise.resolve(result);
    collapse();
    expandedBatchId = batchId;
    result = emptyChildren();
    return new Promise<ImportBatchChildren>((resolve) => {
      resolvePending = resolve;
      const receive = (kind: ImportBatchChildKind, rows: unknown[]) => {
        if (expandedBatchId !== batchId) return;
        const items = rows.filter((item): item is ImportBatchChild => Boolean(item) && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string');
        result = { ...result, [kind]: items };
        seen.add(kind);
        if (seen.size === 2) {
          resolve(result);
          resolvePending = null;
        }
      };
      const fallback = () => {
        if (!api) return;
        void api.get(batchId).then((children) => {
          if (expandedBatchId !== batchId) return;
          result = children;
          resolve(result);
          resolvePending = null;
        });
      };
      for (const kind of ['familyPlans', 'reviewItems'] as const) {
        try {
          stops.push(listener.subscribe(batchId, kind, (rows) => receive(kind, rows), fallback));
        } catch {
          fallback();
        }
      }
    });
  };

  return { loadChildren, collapse, close: () => collapse() };
}

function createFirestoreChildrenListener(uid: string): ImportBatchChildrenListener {
  return {
    subscribe(batchId, kind, rows, error) {
      const ref = collection(db, 'users', uid, 'importBatches', batchId, kind);
      return onSnapshot(query(ref, orderBy('__name__'), limit(100)), (snapshot) => rows(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))), error);
    },
  };
}

function createImportBatchChildrenApi(user: Pick<User, 'getIdToken'>): ImportBatchChildrenApi {
  return {
    async get(batchId) {
      const token = await user.getIdToken();
      const response = await fetch(`/api/v1/import-batches/${encodeURIComponent(batchId)}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({})) as { data?: unknown };
      if (!response.ok) throw new Error(`Import batch children failed (${response.status})`);
      return mapImportBatchChildren(payload.data) ?? emptyChildren();
    },
  };
}

export function useImportBatchChildren({ user, isAuthLoading }: { user: User | null; isAuthLoading: boolean }) {
  const [children, setChildren] = useState<Record<string, ImportBatchChildren>>({});
  const controller = useRef<ReturnType<typeof createImportBatchChildrenController> | null>(null);

  useEffect(() => {
    if (isAuthLoading || !user?.uid) {
      controller.current?.close();
      controller.current = null;
      setChildren({});
      return;
    }
    const next = createImportBatchChildrenController({ listener: createFirestoreChildrenListener(user.uid), api: createImportBatchChildrenApi(user) });
    controller.current = next;
    return () => {
      next.close();
      if (controller.current === next) controller.current = null;
    };
  }, [isAuthLoading, user]);

  const loadChildren = async (batchId: string) => {
    if (!controller.current) return emptyChildren();
    const value = await controller.current.loadChildren(batchId);
    setChildren((previous) => ({ ...previous, [batchId]: value }));
    return value;
  };

  return { children, loadChildren, collapse: (batchId: string) => controller.current?.collapse(batchId) };
}
