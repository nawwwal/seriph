import type { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';

type ShelfItem = FontFamily | ShelfFamily;

export interface ShelfFamilyGroup {
  key: string;
  label: string;
  families: ShelfItem[];
}

function groupLabelForFamily(family: ShelfItem): string {
  const first = family.name.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

export function groupShelfFamilies(families: ShelfItem[]): ShelfFamilyGroup[] {
  const keyCounts = new Map<string, number>();
  const groups: ShelfFamilyGroup[] = [];
  for (const family of families) {
    const label = groupLabelForFamily(family);
    const current = groups[groups.length - 1];
    if (current?.label === label) {
      current.families.push(family);
      continue;
    }
    const baseKey = `${label}-${encodeURIComponent(family.id)}`;
    const count = keyCounts.get(baseKey) ?? 0;
    keyCounts.set(baseKey, count + 1);
    groups.push({ key: count === 0 ? baseKey : `${baseKey}-${count}`, label, families: [family] });
  }
  return groups;
}
