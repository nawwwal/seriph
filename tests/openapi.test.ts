import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const specPath = 'docs/openapi/seriph-api.yaml';
const { load: loadYaml }: { load(input: string): unknown } = createRequire(import.meta.url)('js-yaml');

function pathBlock(spec: string, path: string): string {
  const start = spec.indexOf(`  ${path}:`);
  if (start === -1) return '';
  const next = spec.slice(start + 1).search(/\n  \/api\/v1\//);
  return next === -1 ? spec.slice(start) : spec.slice(start, start + 1 + next);
}

describe('OpenAPI contract', () => {
  it('documents every v1 app API route', () => {
    const spec = readFileSync(specPath, 'utf8');
    const requiredPaths = [
      '/api/v1/families',
      '/api/v1/families/stats',
      '/api/v1/families/{familyId}',
      '/api/v1/families/bulk-delete',
      '/api/v1/families/{familyId}/fonts/{fontId}',
      '/api/v1/family-merges',
      '/api/v1/family-merges/{mergeId}/undo',
      '/api/v1/search',
      '/api/v1/search-index',
      '/api/v1/shares',
    ];

    expect(spec).toContain('openapi: 3.1.0');
    for (const path of requiredPaths) expect(spec).toContain(path);
    for (const schema of ['ShelfFamily', 'ShelfStatsSummary', 'FontFamilyDetail', 'FontFace', 'FamilyListEnvelope', 'FamilyStatsEnvelope', 'FamilyDetailEnvelope', 'FamilyPatchRequest', 'FamilyMergeRequest', 'FamilyMergeEnvelope', 'FamilyMergeUndoEnvelope', 'BulkFamilyDeleteEnvelope', 'SearchEnvelope', 'SearchIndexEnvelope', 'ShareEnvelope', 'ApiError']) {
      expect(spec).toContain(`${schema}:`);
    }
  });

  it('defines JSON envelopes and shared error refs for every operation', () => {
    const spec = readFileSync(specPath, 'utf8');
    for (const response of ['BadRequest', 'Unauthorized', 'Forbidden', 'NotFound', 'PayloadTooLarge', 'InternalError']) {
      expect(spec).toContain(`${response}:`);
    }
    for (const path of ['/api/v1/families', '/api/v1/families/stats', '/api/v1/families/{familyId}', '/api/v1/families/bulk-delete', '/api/v1/family-merges', '/api/v1/search', '/api/v1/search-index', '/api/v1/shares']) {
      const block = pathBlock(spec, path);
      expect(block).toContain("application/json");
      expect(block).toContain("$ref: '#/components/responses/Unauthorized'");
    }
    for (const path of ['/api/v1/family-merges', '/api/v1/search', '/api/v1/shares']) {
      expect(pathBlock(spec, path)).toContain('requestBody:');
    }
  });

  it('documents typed family enrichment', () => {
    const spec = readFileSync(specPath, 'utf8');
    const document = loadYaml(spec) as {
      components: { schemas: { FamilyEnrichment: { properties: Record<string, Record<string, unknown>> } } };
    };
    const detail = spec.slice(spec.indexOf('    FontFamilyDetail:'), spec.indexOf('    FamilyListEnvelope:'));
    const enrichment = document.components.schemas.FamilyEnrichment.properties;

    expect(spec).toContain('    FamilyEnrichment:');
    expect(detail).toContain("$ref: '#/components/schemas/FamilyEnrichment'");
    for (const field of ['description:', 'moods:', 'useCases:']) expect(detail).toContain(field);
    for (const field of ['classification', 'summary', 'voice']) {
      expect(enrichment[field]).toMatchObject({ type: 'string' });
    }
    for (const field of ['moods', 'useCases', 'pairingHints']) {
      expect(enrichment[field]).toMatchObject({ type: 'array', items: { type: 'string' } });
    }
    expect(enrichment.confidence).toMatchObject({ type: 'number', minimum: 0, maximum: 1 });
    expect(enrichment.enrichedAt).toMatchObject({ type: 'string', format: 'date-time' });
  });

  it('removes the retired upload API from the published contract', () => {
    const spec = readFileSync(specPath, 'utf8');
    for (const path of ['/api/v1/uploads/registrations', '/api/v1/uploads/direct-submissions', '/api/v1/uploads/active', '/api/v1/uploads/{ingestId}']) {
      expect(spec).not.toContain(path);
    }
  });
});
