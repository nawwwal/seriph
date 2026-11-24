import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cache = new Map();

function loadTs(filePath) {
  const full = filePath.endsWith('.ts') ? filePath : `${filePath}.ts`;
  if (cache.has(full)) return cache.get(full);
  const source = readFileSync(full, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const mod = { exports: {} };
  cache.set(full, mod.exports);
  const customRequire = (spec) => {
    if (spec.startsWith('@/')) return loadTs(resolve(rootDir, spec.slice(2)));
    if (spec.startsWith('.')) return loadTs(resolve(dirname(full), spec));
    return require(spec);
  };
  new Function('exports', 'module', 'require', outputText)(mod.exports, mod, customRequire);
  cache.set(full, mod.exports);
  return mod.exports;
}

const { rankLocalSearch } = loadTs(resolve(rootDir, 'lib/search/localSearch.ts'));
const { buildSearchFacets, emptySearchFilters } = loadTs(resolve(rootDir, 'lib/search/searchFilters.ts'));
const { readShelfSearchSeed } = loadTs(resolve(rootDir, 'lib/search/searchIndexCache.ts'));
const { deriveAvailableInitials, filterFamiliesByInitial } = loadTs(resolve(rootDir, 'components/home/alphabetFilter.ts'));

test('rankLocalSearch prevents "serif" queries from matching Sans Serif fonts', () => {
  const items = [
    { id: '1', slug: 'ginto', name: 'Ginto', normalizedName: 'ginto', classification: 'Sans Serif', styleCount: 4, isVariable: false, updatedAt: '', searchText: 'Ginto Sans Serif', searchPrimaryText: 'Ginto Sans Serif', searchSecondaryText: '', searchTokens: ['ginto', 'sans', 'serif'], source: 'local' },
    { id: '2', slug: 'caslon', name: 'Caslon', normalizedName: 'caslon', classification: 'Serif', styleCount: 2, isVariable: false, updatedAt: '', searchText: 'Caslon Editorial Serif', searchPrimaryText: 'Caslon Serif', searchSecondaryText: '', searchTokens: ['caslon', 'serif', 'editorial'], source: 'local' },
  ];
  const results = rankLocalSearch(items, 'serif', 10);
  assert.deepEqual(results.map((r) => r.slug), ['caslon']);
});

test('buildSearchFacets keeps selected zero-count filter options interactive', () => {
  const facets = buildSearchFacets([], { ...emptySearchFilters, classifications: ['Serif'], moods: ['Editorial'] });
  assert.equal(facets.classifications[0].value, 'Serif');
  assert.equal(facets.classifications[0].count, 0);
  assert.equal(facets.moods[0].value, 'Editorial');
});

test('readShelfSearchSeed marks libraryRevision -1 so bare shelf summaries never poison search cache', () => {
  const prevStorage = globalThis.localStorage;
  const store = new Map([[
    'seriphShelfFamilies_v2_u1',
    JSON.stringify({
      timestamp: Date.now(),
      data: {
        stats: { libraryRevision: 42 },
        families: [{ id: 'a', name: 'Alpha', normalizedName: 'alpha', classification: 'Sans Serif', styleCount: 1, isVariable: false, updatedAt: '2026-01-01' }],
      },
    }),
  ]]);
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null };
  try {
    const seed = readShelfSearchSeed('u1');
    assert.equal(seed.libraryRevision, -1);
  } finally {
    globalThis.localStorage = prevStorage;
  }
});

test('alphabetFilter maps numeric/symbol families into # bucket alongside A-Z', () => {
  const families = [{ name: '36 Days' }, { name: 'Alpha' }, { name: 'Zebra' }];
  assert.deepEqual(deriveAvailableInitials(families), ['A', 'Z', '#']);
  assert.deepEqual(filterFamiliesByInitial(families, '#').map((f) => f.name), ['36 Days']);
});
