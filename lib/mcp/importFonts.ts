import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { importBatchApi } from '@/lib/imports/importBatchApi';
import { runDurableUpload } from '@/lib/hooks/useDurableBatchUpload';
import type { WebMcpTool } from '@/lib/webmcp/modelContext';

const ALLOWED = /\.(ttf|otf|woff2?|zip)$/i;

function fileNameFrom(url: URL): string {
  const base = url.pathname.split('/').pop() || 'font.ttf';
  return ALLOWED.test(base) ? base : `${base}.ttf`;
}

async function fileFromUrl(raw: string): Promise<File> {
  const url = new URL(raw);
  const local = url.protocol === 'http:' && url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !local) throw new Error(`blocked url: ${raw}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fetch failed ${response.status}`);
  const buffer = await response.arrayBuffer();
  const name = fileNameFrom(url);
  return new File([buffer], name, { type: name.endsWith('.zip') ? 'application/zip' : 'font/ttf' });
}

export function importFontsTool(getIdToken: () => Promise<string>): WebMcpTool {
  return {
    name: 'import_fonts',
    description: 'Import font files from HTTPS URLs into the signed-in catalog via durable upload.',
    inputSchema: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'HTTPS URLs of ttf, otf, woff, woff2, or zip files.',
        },
      },
      required: ['urls'],
    },
    async execute(input) {
      const urls = Array.isArray(input.urls) ? input.urls.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
      if (!urls.length) throw new Error('urls required');
      const files = await Promise.all(urls.slice(0, 8).map(fileFromUrl));
      const token = await getIdToken();
      const api = importBatchApi(token);
      const sources = files.map((file) => ({ file, relativePath: file.name, sourceId: crypto.randomUUID() }));
      const result = await runDurableUpload(sources, {
        ...api,
        resume: async (session, rows) => rows.map((row) => ({
          ...row,
          accepted: true,
          storagePath: `intake/${session.ownerId}/${session.batchId}/${row.sourceId}/${row.originalName.split('/').pop() || 'source'}`,
        })),
        upload: (source, file, progress) => new Promise((resolve, reject) => {
          const task = uploadBytesResumable(ref(storage, source.storagePath!), file);
          task.on('state_changed', (snap) => progress(snap.totalBytes ? Math.round(snap.bytesTransferred / snap.totalBytes * 100) : 0), reject, () => { progress(100); resolve(); });
        }),
      });
      if (!result.ok) throw new Error(result.error instanceof Error ? result.error.message : 'import failed');
      return { batchId: result.batchId, files: files.map((file) => file.name) };
    },
    annotations: { readOnlyHint: false, consequentialHint: true, untrustedContentHint: false },
  };
}
