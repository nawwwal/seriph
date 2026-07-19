import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const specPath = 'docs/openapi/seriph-api.yaml';
const { load: loadYaml }: { load(input: string): unknown } = createRequire(import.meta.url)('js-yaml');
const operations: Record<string, string[]> = {
  '/api/v1/families': ['get'], '/api/v1/families/stats': ['get'], '/api/v1/families/{familyId}': ['get', 'patch'],
  '/api/v1/families/bulk-delete': ['post'], '/api/v1/families/{familyId}/fonts/{fontId}': ['delete'],
  '/api/v1/family-merges': ['post'], '/api/v1/family-merges/{mergeId}/undo': ['post'],
  '/api/v1/search': ['options', 'post'], '/api/v1/search-index': ['get'], '/api/v1/shares': ['post'],
  '/api/v1/import-batches': ['get', 'post'], '/api/v1/import-batches/{batchId}': ['get'],
  '/api/v1/import-batches/{batchId}/sources': ['post'], '/api/v1/import-batches/{batchId}/seal': ['post'],
  '/api/v1/import-batches/{batchId}/sources/{sourceId}/failure': ['post'],
  '/api/v1/import-batches/{batchId}/actions/retry': ['post'], '/api/v1/import-batches/{batchId}/actions/cancel': ['post'],
};
const pathBlock = (spec: string, path: string) => {
  const start = spec.indexOf(`  ${path}:`); if (start < 0) return '';
  const next = spec.slice(start + 1).search(/\n  \/api\/v1\//); return next < 0 ? spec.slice(start) : spec.slice(start, start + 1 + next);
};

describe('OpenAPI contract', () => {
  it('documents every canonical v1 operation and DTO', () => {
    const spec = readFileSync(specPath, 'utf8');
    expect(spec).toContain('openapi: 3.1.0');
    for (const [path, methods] of Object.entries(operations)) {
      const block = pathBlock(spec, path); expect(block).toContain(path);
      for (const method of methods) expect(block).toMatch(new RegExp(`\\n    ${method}:`));
    }
    for (const schema of ['ShelfFamily', 'ShelfStatsSummary', 'FontFamilyDetail', 'FontFace', 'FamilyListEnvelope', 'FamilyStatsEnvelope', 'FamilyDetailEnvelope', 'FamilyPatchRequest', 'FamilyMergeRequest', 'FamilyMergeEnvelope', 'FamilyMergeUndoEnvelope', 'BulkFamilyDeleteEnvelope', 'SearchEnvelope', 'SearchIndexEnvelope', 'ShareEnvelope', 'ImportError', 'ImportPhase', 'ImportBatchCounters', 'ImportBatch', 'ImportSource', 'ImportFamilyPlan', 'ImportReviewItem', 'ApiError']) expect(spec).toContain(`${schema}:`);
  });

  it('uses JSON envelopes, auth, limits, and rate-limit refs', () => {
    const spec = readFileSync(specPath, 'utf8');
    for (const response of ['BadRequest', 'Conflict', 'Unauthorized', 'Forbidden', 'NotFound', 'PayloadTooLarge', 'TooManyRequests', 'InternalError']) expect(spec).toContain(`${response}:`);
    for (const path of Object.keys(operations)) {
      const block = pathBlock(spec, path); if (path !== '/api/v1/search' || !block.includes('options:')) expect(block).toContain('application/json');
      expect(block).toContain("$ref: '#/components/responses/Unauthorized'");
    }
    expect(spec).toContain("'413':"); expect(spec).toContain("'429':");
  });

  it('keeps enrichment typed and import commands explicit', () => {
    const spec = readFileSync(specPath, 'utf8');
    const document = loadYaml(spec) as { components: { schemas: Record<string, { properties?: Record<string, unknown> }> } };
    const enrichment = document.components.schemas.FamilyEnrichment.properties!;
    for (const field of ['classification', 'summary', 'voice']) expect(enrichment[field]).toMatchObject({ type: 'string' });
    for (const field of ['moods', 'useCases', 'pairingHints']) expect(enrichment[field]).toMatchObject({ type: 'array', items: { type: 'string' } });
    for (const path of ['/api/v1/import-batches', '/api/v1/import-batches/{batchId}/actions/retry', '/api/v1/import-batches/{batchId}/actions/cancel']) expect(pathBlock(spec, path)).toContain('IdempotencyKey');
    expect(spec).toContain('ImportSourcesRequest:'); expect(spec).toContain('ImportSourceFailureRequest:'); expect(spec).toContain('ImportRetryRequest:');
  });

  it('keeps the published surface on canonical v1 routes', () => {
    const spec = readFileSync(specPath, 'utf8');
    for (const path of ['/api/v1/uploads/registrations', '/api/v1/uploads/direct-submissions', '/api/v1/uploads/active', '/api/v1/uploads/{ingestId}']) expect(spec).not.toContain(path);
  });
});
