import { NextRequest, NextResponse } from 'next/server';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, type ApiErrorCode } from '@/lib/server/apiResponse';
import { isJsonObject, readJsonObject } from '@/lib/server/apiRequest';
import { searchFunctionUrl } from '@/lib/search/searchEndpoint';

export const runtime = 'nodejs';

const CORS = { 'Access-Control-Allow-Origin': '*' };

function searchError(status: number, details: unknown): Response {
  const code: ApiErrorCode = status === 400
    ? 'bad_request'
    : status === 401
      ? 'unauthorized'
      : status === 403
        ? 'forbidden'
        : status === 404
          ? 'not_found'
          : status === 429
            ? 'rate_limited'
            : 'internal_error';
  return fail(code, 'Search failed', status, details, { headers: CORS });
}

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
    // Strip any client-supplied ownerId; always inject from the verified token.
    const searchPayload = {
      ...payload,
      filters: { ...filters, ownerId: uid },
    };

    const endpoint = searchFunctionUrl({ SEARCH_FUNCTION_URL: process.env.SEARCH_FUNCTION_URL });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: request.headers.get('authorization') ?? '',
      },
      body: JSON.stringify(searchPayload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return searchError(res.status, data);
    return ok(data, { headers: CORS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('POST /api/search failed', err);
    return fail('internal_error', 'Search failed', 500, msg, { headers: CORS });
  }
}
