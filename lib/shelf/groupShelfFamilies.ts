import type { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';

type ShelfItem = FontFamily | ShelfFamily;

export interface ShelfFamilyGroup {
  label: string;
  families: ShelfItem[];
}

function groupLabelForFamily(family: ShelfItem): string {
  const first = family.name.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

export function groupShelfFamilies(families: ShelfItem[]): ShelfFamilyGroup[] {
  const groupsByLabel = new Map<string, ShelfFamilyGroup>();
  for (const family of families) {
    const label = groupLabelForFamily(family);
    const group = groupsByLabel.get(label);
    if (group) group.families.push(family);
    else groupsByLabel.set(label, { label, families: [family] });
  }
  return [...groupsByLabel.values()];
}
