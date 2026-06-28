import { normalizeFamilyName } from '@/utils/normalizationSpec';
import type { ParseResult } from '@/lib/workers/fontParseTypes';

export interface PreviewFile {
  id: string;
  file: File;
  parseResult?: ParseResult;
  parseError?: string;
}

export interface PreviewFamily {
  normalizedName: string;
  provisionalName: string;
  files: PreviewFile[];
  styles: Set<string>;
  conflicts: Array<{ style: string; files: PreviewFile[] }>;
  hasVariable: boolean;
  totalSize: number;
  formats: Set<string>;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Group successfully-parsed files by normalized family name, tracking style conflicts. */
export function groupFilesByFamily(files: PreviewFile[]): PreviewFamily[] {
  const families = new Map<string, PreviewFamily>();

  for (const file of files) {
    if (!file.parseResult?.success || !file.parseResult.provisionalFamily) continue;

    const provisionalName = file.parseResult.provisionalFamily;
    const normalizedName = normalizeFamilyName(provisionalName);
    const subfamily = file.parseResult.subfamily || 'Regular';

    let family = families.get(normalizedName);
    if (!family) {
      family = {
        normalizedName, provisionalName, files: [], styles: new Set(),
        conflicts: [], hasVariable: false, totalSize: 0, formats: new Set(),
      };
      families.set(normalizedName, family);
    }

    family.files.push(file);
    family.totalSize += file.file.size;
    family.formats.add((file.file.name.split('.').pop()?.toLowerCase() || '').toUpperCase());
    if (file.parseResult.isVariable) family.hasVariable = true;

    const existing = family.files.filter((f) => f.parseResult?.subfamily === subfamily && f.id !== file.id);
    if (existing.length > 0) {
      const conflict = family.conflicts.find((c) => c.style === subfamily);
      if (conflict) conflict.files.push(file);
      else family.conflicts.push({ style: subfamily, files: [file, ...existing] });
    } else {
      family.styles.add(subfamily);
    }
  }

  return Array.from(families.values());
}
