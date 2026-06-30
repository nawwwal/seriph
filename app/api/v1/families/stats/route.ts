import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { getShelfStats } from '@/lib/server/catalogFamilyStats';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();

  try {
    return ok(await getShelfStats(getAdminDb(), uid));
  } catch (error) {
    console.error('GET /api/v1/families/stats failed', error);
    return fail('internal_error', 'Failed to fetch shelf stats', 500);
  }
}
