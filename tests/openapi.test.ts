import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const specPath = 'docs/openapi/seriph-api.yaml';
const { load: loadYaml }: { load(input: string): unknown } = createRequire(import.meta.url)('js-yaml');
const routeMethods = new Set(['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']);
type OpenApiPath = Record<string, Record<string, unknown>>;
type OpenApiDocument = { openapi?: string; paths?: Record<string, OpenApiPath>; components: { responses: Record<string, unknown>; schemas: Record<string, { properties?: Record<string, unknown> }> } };

function openApiPath(segments: string[]) {
  return `/api/v1/${segments.map((segment) => segment.replace(/^\[\.\.\.?(.+)\]$/, '{$1}').replace(/^\[(.+)\]$/, '{$1}')).join('/')}`;
}

function deriveRouteMethods(root: string) {
  const routes = new Map<string, string[]>();
  function visit(directory: string, segments: string[]) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath, [...segments, entry.name]);
      if (entry.name !== 'route.ts') continue;
      const source = readFileSync(entryPath, 'utf8');
      const methods = [...source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PATCH|DELETE|OPTIONS)\b/g)]
        .map((match) => match[1]!.toLowerCase()).filter((method) => routeMethods.has(method.toUpperCase())).sort();
      routes.set(openApiPath(segments), methods);
    }
  }
  visit(root, []);
  return routes;
}

function readDocument() {
  return loadYaml(readFileSync(specPath, 'utf8')) as OpenApiDocument;
}

function serializedOperation(document: OpenApiDocument, route: string) {
  return JSON.stringify(document.paths?.[route] ?? {});
}

describe('OpenAPI contract', () => {
  it('derives every app route method and compares it with the document', () => {
    const document = readDocument();
    const routes = deriveRouteMethods(path.resolve('app/api/v1'));
    const documented = Object.fromEntries(Object.entries(document.paths ?? {}).filter(([route]) => route.startsWith('/api/v1/')).map(([route, operations]) => [route, Object.keys(operations).filter((method) => routeMethods.has(method.toUpperCase())).sort()]));
    expect(document.openapi).toBe('3.1.0');
    expect(documented).toEqual(Object.fromEntries([...routes.entries()]));
    for (const schema of ['ShelfFamily', 'ShelfStatsSummary', 'FontFamilyDetail', 'FontFace', 'FamilyListEnvelope', 'FamilyStatsEnvelope', 'FamilyDetailEnvelope', 'FamilyPatchRequest', 'FamilyMergeRequest', 'FamilyMergeEnvelope', 'FamilyMergeUndoEnvelope', 'BulkFamilyDeleteEnvelope', 'SearchEnvelope', 'SearchIndexEnvelope', 'ShareEnvelope', 'ImportError', 'ImportPhase', 'ImportBatchCounters', 'ImportBatch', 'ImportSource', 'ImportFamilyPlan', 'ImportReviewItem', 'ApiError']) expect(document.components.schemas[schema]).toBeDefined();
  });

  it('uses JSON envelopes, auth, limits, and rate-limit refs', () => {
    const document = readDocument();
    for (const response of ['BadRequest', 'Conflict', 'Unauthorized', 'Forbidden', 'NotFound', 'PayloadTooLarge', 'TooManyRequests', 'InternalError']) expect(document.components.responses[response]).toBeDefined();
    for (const route of Object.keys(document.paths ?? {}).filter((entry) => entry.startsWith('/api/v1/'))) {
      const operation = serializedOperation(document, route); if (route !== '/api/v1/search' || !operation.includes('options')) expect(operation).toContain('application/json');
      expect(operation).toContain('#/components/responses/Unauthorized');
    }
    const spec = readFileSync(specPath, 'utf8'); expect(spec).toContain("'413':"); expect(spec).toContain("'429':");
  });

  it('keeps enrichment typed and import commands explicit', () => {
    const document = readDocument();
    const enrichment = document.components.schemas.FamilyEnrichment.properties!;
    for (const field of ['classification', 'summary', 'voice']) expect(enrichment[field]).toMatchObject({ type: 'string' });
    for (const field of ['moods', 'useCases', 'pairingHints']) expect(enrichment[field]).toMatchObject({ type: 'array', items: { type: 'string' } });
    for (const route of ['/api/v1/import-batches', '/api/v1/import-batches/{batchId}/actions/retry', '/api/v1/import-batches/{batchId}/actions/cancel']) expect(serializedOperation(document, route)).toContain('IdempotencyKey');
    const spec = readFileSync(specPath, 'utf8'); expect(spec).toContain('ImportSourcesRequest:'); expect(spec).toContain('ImportSourceFailureRequest:'); expect(spec).toContain('ImportRetryRequest:');
  });

  it('keeps the published surface on canonical v1 routes', () => {
    const spec = readFileSync(specPath, 'utf8');
    for (const route of ['/api/v1/uploads/registrations', '/api/v1/uploads/direct-submissions', '/api/v1/uploads/active', '/api/v1/uploads/{ingestId}']) expect(spec).not.toContain(route);
  });
});
