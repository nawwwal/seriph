'use client';

import { Button } from '@/components/ui/Button';
import type { FamilyMergeSuggestion } from '@/lib/api/mergeSuggestions';

interface MergeSuggestionsBarProps {
  suggestions: FamilyMergeSuggestion[];
  onReview: (familyIds: string[]) => void;
  onDismiss?: (suggestionId: string) => void;
}

export default function MergeSuggestionsBar({ suggestions, onReview, onDismiss }: MergeSuggestionsBarProps) {
  if (!suggestions.length) return null;
  return (
    <aside className="mb-4 rule p-3">
      <p className="text-[10px] font-black uppercase opacity-60">Possible duplicates</p>
      <ul className="mt-2 grid gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>
              {suggestion.names[0]} and {suggestion.names[1]} look {suggestion.verdict === 'same' ? 'like the same family' : 'related'}.
            </span>
            <div className="flex items-center gap-2">
              {onDismiss && (
                <Button tone="plain" size="mdText" onClick={() => onDismiss(suggestion.id)}>
                  Dismiss
                </Button>
              )}
              <Button size="mdText" onClick={() => onReview(suggestion.slugs)}>
                Review
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
