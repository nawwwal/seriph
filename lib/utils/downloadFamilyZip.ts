import type { FontFamily } from '@/models/font.models';

function uniqueEntryName(used: Map<string, number>, rawName: string): string {
  const safe = rawName.replace(/[/\\]/g, '_') || 'font.woff2';
  const count = used.get(safe) ?? 0;
  used.set(safe, count + 1);
  if (count === 0) return safe;
  const dot = safe.lastIndexOf('.');
  return dot > 0 ? `${safe.slice(0, dot)} (${count + 1})${safe.slice(dot)}` : `${safe} (${count + 1})`;
}

/** Zip every face's asset and trigger a download. Returns false if nothing was added. */
export async function downloadFamilyZip(family: FontFamily): Promise<boolean> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const usedNames = new Map<string, number>();
  let added = 0;

  await Promise.all(
    (family.fonts || []).map(async (font) => {
      const meta = font.metadata as Record<string, unknown> | undefined;
      const url = (typeof meta?.downloadUrl === 'string' && meta.downloadUrl) || (typeof meta?.cdnUrl === 'string' && meta.cdnUrl);
      if (!url) return;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        const ext = (font.format || 'woff2').toLowerCase();
        const base = font.filename || `${font.subfamily || 'style'}.${ext}`;
        zip.file(uniqueEntryName(usedNames, base), blob);
        added += 1;
      } catch { /* skip individual failures */ }
    })
  );

  if (added === 0) return false;
  const content = await zip.generateAsync({ type: 'blob' });
  const href = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = href;
  a.download = `${family.name.replace(/[/\\]/g, '_') || 'fonts'}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return true;
}
