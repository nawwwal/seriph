import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { ok, unauthorized, fail } from '@/lib/server/apiResponse';
import { getUidFromRequest } from '@/lib/server/auth';
import { listSearchIndex } from '@/lib/server/searchIndex';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();

  try {
    const data = await listSearchIndex(getAdminDb(), uid);
    return ok(data, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('GET /api/v1/search-index failed', error);
    return fail('internal_error', 'Failed to fetch search index', 500);
  }
}
