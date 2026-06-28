import type { FontFamily } from '@/models/font.models';

/** Zip every face's asset and trigger a download. Returns false if nothing was added. */
export async function downloadFamilyZip(family: FontFamily): Promise<boolean> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  let added = 0;

  await Promise.all(
    (family.fonts || []).map(async (font) => {
      const url =
        ((font.metadata as any)?.downloadUrl as string | undefined) ||
        ((font.metadata as any)?.cdnUrl as string | undefined);
      if (!url) return;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        const ext = (font.format || 'woff2').toLowerCase();
        const safe = (font.filename || `${font.subfamily || 'style'}.${ext}`).replace(/[/\\]/g, '_');
        zip.file(safe, blob);
        added += 1;
      } catch {
        /* skip individual failures */
      }
    })
  );

  if (added === 0) return false;
  const content = await zip.generateAsync({ type: 'blob' });
  const href = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = href;
  a.download = `${family.name.replace(/[/\\]/g, '_')}.zip`;
  a.click();
  URL.revokeObjectURL(href);
  return true;
}
