import type { FontFamily } from '@/models/font.models';

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

async function postJson<T>({
  path,
  getIdToken,
  body,
}: {
  path: string;
  getIdToken: () => Promise<string>;
  body: Record<string, unknown>;
}): Promise<T> {
  const token = await getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !json.data) {
    throw new Error(json.error?.message || `Request failed: ${response.status}`);
  }
  return json.data;
}

export interface FamilyMergeResult {
  mergeId: string;
  targetFamilyId: string;
  undoExpiresAt: string;
  family: FontFamily | null;
}

export function mergeFamilies({
  getIdToken,
  familyIds,
  targetFamilyId,
}: {
  getIdToken: () => Promise<string>;
  familyIds: string[];
  targetFamilyId: string;
}): Promise<FamilyMergeResult> {
  return postJson({
    path: '/api/v1/family-merges',
    getIdToken,
    body: { familyIds, targetFamilyId },
  });
}

export function undoFamilyMerge({
  getIdToken,
  mergeId,
}: {
  getIdToken: () => Promise<string>;
  mergeId: string;
}): Promise<{ restoredFamilyIds: string[] }> {
  return postJson({
    path: `/api/v1/family-merges/${encodeURIComponent(mergeId)}/undo`,
    getIdToken,
    body: {},
  });
}

export function hardDeleteFamilies({
  getIdToken,
  familyIds,
}: {
  getIdToken: () => Promise<string>;
  familyIds: string[];
}): Promise<{ deletedFamilyIds: string[]; deletedAssetCount: number }> {
  return postJson({
    path: '/api/v1/families/bulk-delete',
    getIdToken,
    body: { familyIds, confirm: 'DELETE' },
  });
}
