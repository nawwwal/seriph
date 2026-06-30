interface SearchErrorDisplayInput {
  hasResults: boolean;
  indexError: string | null;
  indexLoading: boolean;
}

export function searchErrorForDisplay(input: SearchErrorDisplayInput): string | null {
  if (input.hasResults || input.indexLoading) return null;
  return input.indexError;
}
