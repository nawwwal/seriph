import type { Request, Response } from 'express';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeRemoteConfig } from '../config/remoteConfig';
import { primeSearchCatalog } from './jevCatalogSearch';
import { searchFonts } from './searchFonts';
import { parseHttpSearchFilters } from './httpFilters';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function uidFromToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    return (await getAuth().verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

function payloadFrom(body: unknown): Record<string, unknown> {
  if (typeof body !== 'string') return isRecord(body) ? body : {};
  try {
    const parsed: unknown = JSON.parse(body || '{}');
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function serveSearchRequest(req: Request, res: Response): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const started = Date.now();
  const payload = payloadFrom(req.body);
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length)
    : undefined;
  const bodyToken = typeof payload.idToken === 'string' ? payload.idToken : undefined;
  const [, uid] = await Promise.all([
    Promise.all([
      initializeRemoteConfig().catch(() => undefined),
      primeSearchCatalog(getFirestore()).catch(() => undefined),
    ]),
    uidFromToken(bearer || bodyToken),
  ]);
  if (!uid) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const similarTo = typeof payload.similarTo === 'string' ? payload.similarTo.trim() : '';
    const response = await searchFonts({
      q: typeof payload.q === 'string' ? payload.q : '',
      limit: typeof payload.limit === 'number' ? payload.limit : undefined,
      debug: payload.debug === true,
      similarTo: similarTo || undefined,
      filters: parseHttpSearchFilters(payload.filters, uid),
    });
    logger.info('search request complete', { totalMs: Date.now() - started, resultCount: response.results.length });
    res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('search request failed', { totalMs: Date.now() - started, message: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Search failed' });
  }
}
