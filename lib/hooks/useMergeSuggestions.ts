'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  dismissMergeSuggestionRequest,
  fetchMergeSuggestions,
  type FamilyMergeSuggestion,
} from '@/lib/api/mergeSuggestions';

export function useMergeSuggestions(user: User | null) {
  const [suggestions, setSuggestions] = useState<FamilyMergeSuggestion[]>([]);

  const reload = useCallback(() => {
    if (!user) return;
    fetchMergeSuggestions(() => user.getIdToken())
      .then((items) => setSuggestions(items))
      .catch(() => setSuggestions([]));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchMergeSuggestions(() => user.getIdToken())
      .then((items) => { if (active) setSuggestions(items); })
      .catch(() => { if (active) setSuggestions([]); });
    return () => { active = false; };
  }, [user]);

  const dismiss = useCallback(async (suggestionId: string) => {
    if (!user) return;
    setSuggestions((prev) => prev.filter((item) => item.id !== suggestionId));
    try {
      await dismissMergeSuggestionRequest(() => user.getIdToken(), suggestionId);
    } catch {
      reload();
    }
  }, [reload, user]);

  return useMemo(() => ({ suggestions, dismiss, reload }), [suggestions, dismiss, reload]);
}
