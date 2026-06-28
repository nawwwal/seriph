import { NextRequest } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';

export type UploadAuth = { uid: string } | { error: 'unauthorized' };

/**
 * Resolve the uploading user's uid from a Firebase ID token. Falls back to a
 * dev-only x-upload-token (UPLOAD_SECRET_TOKEN) in non-production. Returns
 * `{ error: 'unauthorized' }` when neither succeeds.
 */
export async function resolveUploadUid(request: NextRequest): Promise<UploadAuth> {
  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (bearer) {
    try {
      const decoded = await getAdminAuth().verifyIdToken(bearer);
      return { uid: decoded.uid };
    } catch {
      return { error: 'unauthorized' };
    }
  }

  const providedToken = request.headers.get('x-upload-token') || '';
  const requiredToken = process.env.UPLOAD_SECRET_TOKEN || '';
  const isDev = process.env.NODE_ENV !== 'production';
  if (!isDev || !requiredToken || providedToken !== requiredToken) {
    return { error: 'unauthorized' };
  }
  return { uid: `dev-${providedToken}` };
}
