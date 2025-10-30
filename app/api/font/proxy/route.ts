import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function detectContentTypeFromExt(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  if (lower.endsWith('.otf')) return 'font/otf';
  if (lower.endsWith('.eot')) return 'application/vnd.ms-fontobject';
  return 'application/octet-stream';
}

function isAllowedRemote(url: string): boolean {
  try {
    const u = new URL(url);
    // Allow common Firebase/GCS hosts
    const allowedHosts = new Set([
      'storage.googleapis.com',
      'firebasestorage.googleapis.com',
      // Allow buckets over custom domains if needed (e.g., <bucket>.storage.googleapis.com)
    ]);
    if (allowedHosts.has(u.hostname)) return true;
    // Permit subdomains like <bucket>.storage.googleapis.com
    if (u.hostname.endsWith('.storage.googleapis.com')) return true;
    return false;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const urlParam = req.nextUrl.searchParams.get('url');
    if (!urlParam) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    if (!isAllowedRemote(urlParam)) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
    }

    const upstream = await fetch(urlParam, {
      // Avoid passing client cookies; this is a server-to-server fetch
      cache: 'no-store',
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'Failed to fetch upstream font' }, { status: upstream.status || 502 });
    }

    const contentType = upstream.headers.get('content-type') || detectContentTypeFromExt(urlParam);

    // Stream the response to the client under same-origin to avoid CORS issues.
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        // Allow wider usage; not strictly necessary for same-origin but safe for reuse.
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Font proxy error' }, { status: 500 });
  }
}

