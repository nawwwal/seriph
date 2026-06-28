import type { FontFamily } from '@/models/font.models';

/** Download the library as a CSV (family, style, weight, class). */
export function exportCatalogCsv(families: FontFamily[]): void {
  const csv =
    'Family,Style,Weight,Class\n' +
    families
      .flatMap((family) =>
        family.fonts.map(
          (font) => `"${family.name}","${font.subfamily}",${font.weight || 400},"${family.classification}"`
        )
      )
      .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'type-shelf.csv';
  a.click();
  URL.revokeObjectURL(url);
}
