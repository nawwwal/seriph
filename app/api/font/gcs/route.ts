import { NextRequest, NextResponse } from 'next/server';
import { getAdminStorage } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

function isValidPath(p: string): boolean {
  if (!p) return false;
  if (p.startsWith('/')) return false;
  if (p.includes('..')) return false;
  // Optionally restrict to processed/ only. Keep permissive but safe for now.
  return true;
}

function detectContentTypeFromExt(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  if (lower.endsWith('.otf')) return 'font/otf';
  if (lower.endsWith('.eot')) return 'application/vnd.ms-fontobject';
  return 'application/octet-stream';
}

export async function GET(req: NextRequest) {
  try {
    const storagePath = req.nextUrl.searchParams.get('path') || '';
    if (!isValidPath(storagePath)) {
      return NextResponse.json({ error: 'Invalid or missing path' }, { status: 400 });
    }

    const storage = getAdminStorage();
    const file = storage.bucket().file(storagePath);

    // Ensure the object exists and fetch metadata
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const [metadata] = await file.getMetadata();

    const contentType =
      metadata?.contentType || detectContentTypeFromExt(storagePath);
    const cacheControl =
      metadata?.cacheControl || 'public, max-age=31536000, immutable';

    const [readStream] = await Promise.all([file.createReadStream()]);

    // Node streams are not directly supported in NextResponse init body; use Web Streams via ReadableStream
    const stream = new ReadableStream({
      start(controller) {
        readStream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        readStream.on('end', () => controller.close());
        readStream.on('error', (err: any) => controller.error(err));
      },
      cancel() {
        try {
          readStream.destroy();
        } catch {}
      },
    });

    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'GCS proxy error' }, { status: 500 });
  }
}


