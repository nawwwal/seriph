import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';
import { fail, ok, unauthorized } from '@/lib/server/apiResponse';
import { registerImportSources, type RegisterSourceInput } from '@/lib/server/imports/sourceCommands';

export const runtime = 'nodejs';
export const parseSourcesBody = (value: unknown): RegisterSourceInput[] | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).join() !== 'sources') return null;
  const sources = (value as Record<string, unknown>).sources;
  return Array.isArray(sources) && sources.every((source) => source && typeof source === 'object' && !Array.isArray(source) && Object.keys(source).every((key) => ['sourceId', 'originalName', 'relativePath', 'size', 'declaredContentType'].includes(key)) && typeof (source as RegisterSourceInput).sourceId === 'string' && typeof (source as RegisterSourceInput).originalName === 'string' && typeof (source as RegisterSourceInput).relativePath === 'string' && typeof (source as RegisterSourceInput).size === 'number' && ((source as RegisterSourceInput).declaredContentType === undefined || typeof (source as RegisterSourceInput).declaredContentType === 'string')) ? sources as RegisterSourceInput[] : null;
};
export async function POST(request: NextRequest, context: { params: Promise<{ batchId: string }> }) {
  const ownerId = await getUidFromRequest(request); if (!ownerId) return unauthorized();
  const sources = parseSourcesBody(await request.json().catch(() => null)); if (!sources) return fail('bad_request', 'sources are required', 400);
  try { const { batchId } = await context.params; const result = await registerImportSources(getAdminDb(), { ownerId, id: batchId }, sources); return result.kind === 'batch_missing' ? fail('not_found', 'Import batch not found', 404) : ok(result); }
  catch (error) { console.error('POST import sources failed', error); return fail('internal_error', 'Failed to register import sources', 500); }
}
