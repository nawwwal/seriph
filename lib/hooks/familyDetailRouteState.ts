import type { FontFamily } from '@/models/font.models';
import type { FamilyDetailLoadOutcome } from '@/lib/cache/familyDetailClient';

export interface FamilyDetailRequestState {
  uid: string | null;
  familyId: string | null;
  outcome: FamilyDetailLoadOutcome | null;
}

interface DeriveFamilyDetailRouteStateInput {
  activeUid: string | null;
  activeFamilyId: string | null;
  authLoading: boolean;
  hasUser: boolean;
  request: FamilyDetailRequestState;
  cached?: FontFamily | null;
  preview?: FontFamily | null;
}

export type FamilyDetailRouteState = {
  kind: 'loading' | 'loaded' | 'preview' | 'not-found' | 'load-error' | 'signed-out';
  family: FontFamily | null;
  error: string | null;
  isLoading: boolean;
  isPreview: boolean;
};

export function deriveFamilyDetailRouteState({
  activeUid,
  activeFamilyId,
  authLoading,
  hasUser,
  request,
  cached = null,
  preview = null,
}: DeriveFamilyDetailRouteStateInput): FamilyDetailRouteState {
  if (authLoading) return { kind: 'loading', family: null, error: null, isLoading: true, isPreview: false };
  if (!hasUser) return { kind: 'signed-out', family: null, error: null, isLoading: false, isPreview: false };
  if (!activeFamilyId) {
    return {
      kind: 'load-error',
      family: null,
      error: 'Font family ID is not available in the route.',
      isLoading: false,
      isPreview: false,
    };
  }
  const isCurrentRequest = request.uid === activeUid && request.familyId === activeFamilyId;
  const outcome = isCurrentRequest ? request.outcome : null;
  if (outcome?.kind === 'loaded') {
    return { kind: 'loaded', family: outcome.family, error: null, isLoading: false, isPreview: false };
  }
  if (outcome?.kind === 'not-found') {
    return {
      kind: 'not-found',
      family: null,
      error: 'Font family not found. It might have been moved or deleted.',
      isLoading: false,
      isPreview: false,
    };
  }
  if (outcome?.kind === 'load-error') {
    return {
      kind: 'load-error',
      family: null,
      error: 'Could not load the font family details. Please try again later.',
      isLoading: false,
      isPreview: false,
    };
  }
  if (cached) return { kind: 'loaded', family: cached, error: null, isLoading: false, isPreview: false };
  if (preview) return { kind: 'preview', family: preview, error: null, isLoading: false, isPreview: true };
  return { kind: 'loading', family: null, error: null, isLoading: true, isPreview: false };
}
