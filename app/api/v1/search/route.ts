import { NextRequest, NextResponse } from 'next/server';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, type ApiErrorCode } from '@/lib/server/apiResponse';
import { isJsonObject, readJsonObject } from '@/lib/server/apiRequest';

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
  if (!uid) return fail('unauthorized', 'Unauthorized', 401, undefined, { headers: CORS });

  try {
    const body = await readJsonObject(request);
    if (!body.ok) return fail('bad_request', body.message, 400, undefined, { headers: CORS });
    const payload = body.value;
    const filters = isJsonObject(payload.filters) ? payload.filters : {};
    const endpoint =
      process.env.SEARCH_FUNCTION_URL ||
      process.env.SEARCH_SERVICE_URL ||
      'https://us-central1-seriph.cloudfunctions.net/searchFontsHttpUs';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: request.headers.get('authorization') ?? '',
      },
      body: JSON.stringify({
        ...payload,
        filters: { ...filters, ownerId: uid },
      }),
      signal: request.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const code: ApiErrorCode = res.status === 400
        ? 'bad_request'
        : res.status === 401
          ? 'unauthorized'
          : res.status === 403
            ? 'forbidden'
            : res.status === 404
              ? 'not_found'
              : res.status === 429
                ? 'rate_limited'
                : 'internal_error';
      return fail(code, 'Search failed', res.status, data, { headers: CORS });
    }
    return ok(data, { headers: CORS });
  } catch (error) {
    console.error('POST /api/v1/search failed', error);
    return fail('internal_error', 'Search failed', 500, undefined, { headers: CORS });
  }
}
