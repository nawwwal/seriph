import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { listShelfFamilies } from '@/lib/server/catalogFamilies';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();

  try {
    const data = await listShelfFamilies({
      db: getAdminDb(),
      uid,
      limitParam: request.nextUrl.searchParams.get('limit'),
      cursorParam: request.nextUrl.searchParams.get('cursor'),
      includeStats: request.nextUrl.searchParams.get('stats') === '1',
    });
    return ok(data);
  } catch (error) {
    console.error('GET /api/v1/families failed', error);
    return fail('internal_error', 'Failed to fetch families', 500);
  }
}
