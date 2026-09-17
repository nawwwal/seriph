'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { fetchMergeSuggestions, type FamilyMergeSuggestion } from '@/lib/api/mergeSuggestions';
import type { ShelfFamily } from '@/models/shelf.models';

export function useMergeSuggestions(user: User | null, families: ShelfFamily[]) {
  const [suggestions, setSuggestions] = useState<FamilyMergeSuggestion[]>([]);
  const visibleIds = useMemo(() => new Set(families.map((family) => family.id)), [families]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchMergeSuggestions(() => user.getIdToken())
      .then((items) => { if (active) setSuggestions(items); })
      .catch(() => { if (active) setSuggestions([]); });
    return () => { active = false; };
  }, [user]);

  return suggestions.filter((item) => item.slugs.every((slug) => visibleIds.has(slug) || families.some((family) => family.normalizedName === slug)));
}
