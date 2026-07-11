export const LETTER_INITIALS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'] as const;
export const ALPHABET_INITIALS = ['ALL', ...LETTER_INITIALS] as const;

export type AlphabetInitial = (typeof ALPHABET_INITIALS)[number];
export type LetterInitial = (typeof LETTER_INITIALS)[number];

type NamedFamily = {
  name: string;
};

export function deriveAvailableInitials(families: readonly NamedFamily[]): LetterInitial[] {
  const represented = new Set(families.map((family) => family.name.charAt(0).toUpperCase()));
  return LETTER_INITIALS.filter((initial) => represented.has(initial));
}

export function toggleAlphabetInitial(
  selected: AlphabetInitial,
  requested: LetterInitial
): AlphabetInitial {
  return selected === requested ? 'ALL' : requested;
}

export function filterFamiliesByInitial<T extends NamedFamily>(families: T[], initial: AlphabetInitial): T[];
export function filterFamiliesByInitial<T extends NamedFamily>(
  families: readonly T[],
  initial: AlphabetInitial
): readonly T[];
export function filterFamiliesByInitial<T extends NamedFamily>(
  families: readonly T[],
  initial: AlphabetInitial
): readonly T[] {
  if (initial === 'ALL') return families;
  return families.filter((family) => family.name.charAt(0).toUpperCase() === initial);
}
