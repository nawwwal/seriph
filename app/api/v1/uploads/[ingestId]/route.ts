import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { mapIngest } from '@/lib/upload/mapIngest';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{
    ingestId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();
  const { ingestId } = await context.params;

  try {
    const doc = await getAdminDb().collection('users').doc(uid).collection('ingests').doc(ingestId).get();
    if (!doc.exists) return fail('not_found', 'Ingest not found', 404);
    const data = doc.data();
    if (!data) return fail('not_found', 'Ingest not found', 404);
    return ok({ ingest: mapIngest(doc.id, data, uid) });
  } catch (error) {
    console.error(`GET /api/v1/uploads/${ingestId} failed`, error);
    return fail('internal_error', 'Failed to fetch ingest', 500);
  }
}
