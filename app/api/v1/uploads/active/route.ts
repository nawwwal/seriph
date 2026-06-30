import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import {
  queryActiveIngestRows,
  selectActiveIngests,
} from '@/lib/server/activeUploads';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();

  try {
    const rows = await queryActiveIngestRows(getAdminDb().collection('users').doc(uid).collection('ingests'));
    const ingests = selectActiveIngests(rows, uid);
    return ok({ ingests });
  } catch (error) {
    console.error('GET /api/v1/uploads/active failed', error);
    return fail('internal_error', 'Failed to fetch active uploads', 500);
  }
}
