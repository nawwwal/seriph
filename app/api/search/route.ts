import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface SearchFilters {
  classification?: string[];
  license?: string[];
  scripts?: string[];
  isVariable?: boolean;
  axis?: string[];
  weight?: { min?: number; max?: number; point?: number };
  widthClass?: { min?: number; max?: number };
  features?: string[];
  opsz?: { min?: number; max?: number };
  familyIds?: string[];
  styleIds?: string[];
}

interface SearchRequestPayload {
  q?: string;
  filters?: SearchFilters;
  sort?: { by: 'relevance' | 'popularity' | 'newest' };
  page?: number;
  pageSize?: number;
  debug?: boolean;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as SearchRequestPayload;
    const endpoint = process.env.SEARCH_FUNCTION_URL || process.env.SEARCH_SERVICE_URL;

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Search backend not configured. Set SEARCH_FUNCTION_URL environment variable.' },
        { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return NextResponse.json(data, {
      status: response.status,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error: any) {
    console.error('POST /api/search failed', error);
    return NextResponse.json(
      { error: 'Search failed', details: error?.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
