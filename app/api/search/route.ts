import { NextRequest, NextResponse } from 'next/server';
import { getUidFromRequest } from '@/lib/server/auth';

export const runtime = 'nodejs';

const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
  });
}

export async function POST(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });

  try {
    const body = await request.json();
    // Strip any client-supplied ownerId; always inject from the verified token.
    const payload = {
      ...body,
      filters: { ...(body.filters ?? {}), ownerId: uid },
    };

    const endpoint =
      process.env.SEARCH_FUNCTION_URL ||
      process.env.SEARCH_SERVICE_URL ||
      'https://asia-southeast1-seriph.cloudfunctions.net/searchFontsHttp';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status, headers: CORS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('POST /api/search failed', err);
    return NextResponse.json({ error: 'Search failed', details: msg }, { status: 500, headers: CORS });
  }
}
