import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import {
  ACTIVE_ANALYSIS_STATES,
  ACTIVE_UPLOAD_QUERY_LIMIT,
  selectActiveIngests,
} from '@/lib/server/activeUploads';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();

  try {
    const snap = await getAdminDb()
      .collection('users')
      .doc(uid)
      .collection('ingests')
      .where('analysisState', 'in', ACTIVE_ANALYSIS_STATES)
      .orderBy('updatedAt', 'desc')
      .limit(ACTIVE_UPLOAD_QUERY_LIMIT)
      .get();
    const ingests = selectActiveIngests(snap.docs, uid);
    return ok({ ingests });
  } catch (error) {
    console.error('GET /api/v1/uploads/active failed', error);
    return fail('internal_error', 'Failed to fetch active uploads', 500);
  }
}
