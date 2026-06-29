/**
 * HTTP handlers for the Google-Fonts-style serving layer, fronted by Firebase
 * Hosting rewrites:
 *   /css2?family=...  -> css2Handler   (@font-face CSS pointing at the CDN)
 *   /s/**             -> serveFontHandler (woff2/web artifact)
 *   /d/**             -> serveFontHandler (original, as a download)
 */
import type { Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { parseCss2Query, buildCss2 } from './css2';
import { loadCssFamiliesBySlug } from './css2Lookup';
import { publicBucketName } from '../config/catalogConfig';

function queryString(req: Request): URLSearchParams {
  const qs = (req.url || '').split('?')[1] || '';
  return new URLSearchParams(qs);
}

export async function css2Handler(req: Request, res: Response): Promise<void> {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { families, display } = parseCss2Query(queryString(req));
  const slugs = [...new Set(families.map((f) => f.slug))];
  if (slugs.length === 0) {
    res.status(400).set('Content-Type', 'text/plain').send('/* missing family= */');
    return;
  }

  const db = getFirestore();
  const bySlug = await loadCssFamiliesBySlug(db, slugs);
  const css = buildCss2(families, display, (slug) => bySlug.get(slug));
  res
    .status(200)
    .set('Content-Type', 'text/css; charset=utf-8')
    .set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    .send(css);
}

const CONTENT_TYPES: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
};

export async function serveFontHandler(req: Request, res: Response): Promise<void> {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const path = decodeURIComponent(req.path || '');
  const m = path.match(/\/(s|d)\/(.+)$/);
  if (!m || path.includes('..')) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }
  const kind = m[1]; // "s" served, "d" download
  const storagePath = `${kind}/${m[2]}`;
  const ext = (storagePath.split('.').pop() || '').toLowerCase();

  const file = getStorage().bucket(publicBucketName()).file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.set('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (kind === 'd') {
    res.set('Content-Disposition', `attachment; filename="${storagePath.split('/').pop()}"`);
  }

  file
    .createReadStream()
    .on('error', (err) => {
      logger.error('serveFont stream error', { storagePath, message: err.message });
      if (!res.headersSent) res.status(500).json({ error: 'Stream error' });
    })
    .pipe(res);
}
