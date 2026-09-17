import type { SearchResultItem } from '@/models/search.models';
import type { WebMcpTool } from '@/lib/webmcp/modelContext';
import { mcpFetchJson, publicFontUrl } from '@/lib/mcp/api';
import type { FontFamily } from '@/models/font.models';

export interface FontToolContext {
  getIdToken: () => Promise<string>;
  familyId?: string;
}

function familyIdFrom(input: Record<string, unknown>, fallback?: string): string {
  const value = typeof input.familyId === 'string' ? input.familyId.trim() : '';
  return value || fallback || '';
}

async function loadFamily(ctx: FontToolContext, familyId: string): Promise<FontFamily> {
  const data = await mcpFetchJson<{ family: FontFamily }>(`/api/v1/families/${encodeURIComponent(familyId)}`, ctx.getIdToken);
  return data.family;
}

function compactHit(item: SearchResultItem) {
  return {
    slug: item.slug,
    name: item.name,
    classification: item.classification,
    moods: item.moods?.slice(0, 4),
    summary: item.summary?.slice(0, 120),
  };
}

export function seriphFontTools(ctx: FontToolContext): WebMcpTool[] {
  const familyId = {
    type: 'string' as const,
    description: 'Family slug, or omit on a family page.',
  };
  return [
    {
      name: 'search_fonts',
      description: 'Search the signed-in library by name, mood, use, or a similar family.',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Name, mood, or use-case query.' },
          similarTo: { type: 'string', description: 'Family slug to find neighbors of.' },
        },
      },
      async execute(input) {
        const q = typeof input.q === 'string' ? input.q : '';
        const similarTo = typeof input.similarTo === 'string' ? input.similarTo : undefined;
        const data = await mcpFetchJson<{ results?: SearchResultItem[] }>('/api/v1/search', ctx.getIdToken, {
          method: 'POST',
          body: JSON.stringify({ q, similarTo, filters: {} }),
        });
        return (data.results ?? []).slice(0, 12).map(compactHit);
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
    },
    {
      name: 'find_similar',
      description: 'Find vector neighbors of one family in the signed-in library.',
      inputSchema: {
        type: 'object',
        properties: { familyId },
        required: ctx.familyId ? [] : ['familyId'],
      },
      async execute(input) {
        const id = familyIdFrom(input, ctx.familyId);
        if (!id) throw new Error('familyId required');
        const data = await mcpFetchJson<{ results?: SearchResultItem[] }>('/api/v1/search', ctx.getIdToken, {
          method: 'POST',
          body: JSON.stringify({ q: '', similarTo: id, filters: {} }),
        });
        return (data.results ?? []).slice(0, 12).map(compactHit);
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
    },
    {
      name: 'get_pairings',
      description: 'Return stored pairing families for one catalog family.',
      inputSchema: {
        type: 'object',
        properties: { familyId },
        required: ctx.familyId ? [] : ['familyId'],
      },
      async execute(input) {
        const id = familyIdFrom(input, ctx.familyId);
        if (!id) throw new Error('familyId required');
        const family = await loadFamily(ctx, id);
        return family.metadata.enrichment?.pairingFamilies ?? [];
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
    },
    {
      name: 'get_font_asset',
      description: 'Return existing CDN /s and /d URLs. Does not generate files.',
      inputSchema: {
        type: 'object',
        properties: { familyId },
        required: ctx.familyId ? [] : ['familyId'],
      },
      async execute(input) {
        const id = familyIdFrom(input, ctx.familyId);
        if (!id) throw new Error('familyId required');
        const family = await loadFamily(ctx, id);
        return family.fonts.flatMap((font) => {
          const cdnUrl = typeof font.metadata.cdnUrl === 'string' && publicFontUrl(font.metadata.cdnUrl) ? font.metadata.cdnUrl : undefined;
          const downloadUrl = typeof font.metadata.downloadUrl === 'string' && publicFontUrl(font.metadata.downloadUrl) ? font.metadata.downloadUrl : undefined;
          return cdnUrl || downloadUrl ? [{ id: font.id, subfamily: font.subfamily, cdnUrl, downloadUrl }] : [];
        });
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
    },
  ];
}
