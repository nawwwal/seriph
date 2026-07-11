export const ALPHABET_INITIALS = [
  'ALL',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
] as const;

export type AlphabetInitial = (typeof ALPHABET_INITIALS)[number];

type NamedFamily = {
  name: string;
};

export function filterFamiliesByInitial<T extends NamedFamily>(
  families: readonly T[],
  initial: AlphabetInitial
): readonly T[] {
  if (initial === 'ALL') return families;
  return families.filter((family) => family.name.charAt(0).toUpperCase() === initial);
}
