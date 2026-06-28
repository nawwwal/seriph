import { NextRequest, NextResponse } from 'next/server';
import { getAdminStorage } from '@/lib/firebase/admin';
import { getUidFromRequest } from '@/lib/server/auth';

export const runtime = 'nodejs';

// Allowlist: only public-facing font asset prefixes.
// intake/unprocessed/batch paths are never accessible via this proxy.
const ALLOWED_PREFIXES = ['s/', 'd/', 'processed_fonts/'];

const EXT_TYPES: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
};

function isValidPath(p: string): boolean {
  if (!p || p.includes('..') || p.startsWith('/')) return false;
  return ALLOWED_PREFIXES.some((prefix) => p.startsWith(prefix));
}

/** Deprecated fallback for old-schema fonts not yet on the CDN. Requires auth. */
export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const storagePath = req.nextUrl.searchParams.get('path') || '';
  if (!isValidPath(storagePath)) {
    return NextResponse.json({ error: 'Invalid or missing path' }, { status: 400 });
  }

  try {
    const file = getAdminStorage().bucket().file(storagePath);
    const [exists] = await file.exists();
    if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [metadata] = await file.getMetadata();
    const ext = (storagePath.split('.').pop() || '').toLowerCase();
    const contentType = metadata?.contentType || EXT_TYPES[ext] || 'application/octet-stream';
    const readStream = file.createReadStream();

    const stream = new ReadableStream({
      start(controller) {
        readStream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        readStream.on('end', () => controller.close());
        readStream.on('error', (err: unknown) => controller.error(err));
      },
      cancel() { try { readStream.destroy(); } catch {} },
    });

    return new NextResponse(stream as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'GCS proxy error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
