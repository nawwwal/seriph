import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { deleteOwnedFamilyFace } from '@/lib/server/catalogFamilies';
import { rebuildCatalogSummary } from '@/lib/server/catalogSummary';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{
    familyId: string;
    fontId: string;
  }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const uid = await getUidFromRequest(request);
  if (!uid) return unauthorized();
  const { familyId, fontId } = await context.params;

  try {
    const result = await deleteOwnedFamilyFace({
      db: getAdminDb(),
      uid,
      familyId,
      fontId,
    });
    if (!result) return fail('not_found', 'Family not found', 404);
    if (!result.deleted) return fail('not_found', 'Font not found', 404);
    await rebuildCatalogSummary(getAdminDb(), uid);
    return ok({ message: 'Font removed', faces: result.faces });
  } catch (error) {
    console.error(`DELETE /api/v1/families/${familyId}/fonts/${fontId} failed`, error);
    return fail('internal_error', 'Failed to delete font from family', 500);
  }
}
