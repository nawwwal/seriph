import type { Request, Response } from 'express';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { initializeRemoteConfig } from '../config/remoteConfig';
import { searchFonts } from './searchFonts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function uidFromBearer(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return (await getAuth().verifyIdToken(authHeader.slice('Bearer '.length))).uid;
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
  try {
    await initializeRemoteConfig();
  } catch {}
  const uid = await uidFromBearer(req.headers.authorization);
  if (!uid) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = payloadFrom(req.body);
    const filters = isRecord(payload.filters) ? payload.filters : {};
    const response = await searchFonts({
      q: typeof payload.q === 'string' ? payload.q : '',
      limit: typeof payload.limit === 'number' ? payload.limit : undefined,
      debug: payload.debug === true,
      filters: { ownerId: uid, category: typeof filters.category === 'string' ? filters.category : undefined },
    });
    logger.info('search request complete', { totalMs: Date.now() - started, resultCount: response.results.length });
    res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('search request failed', { totalMs: Date.now() - started, message: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Search failed' });
  }
}
