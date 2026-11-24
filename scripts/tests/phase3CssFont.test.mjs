import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function loadTsModule(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  new Function('exports', 'module', outputText)(mod.exports, mod);
  return mod.exports;
}

const { escapeCssString, fontFormatFromUrl, quoteCssFontFamily } = loadTsModule('../../lib/utils/cssFont.ts');

test('quoteCssFontFamily escapes quotes, backslashes, and control characters', () => {
  assert.equal(quoteCssFontFamily("Inter's \\ Mono\n"), "'Inter\\'s \\\\ Mono'");
  assert.equal(escapeCssString("abc'123"), "abc\\'123");
});

test('fontFormatFromUrl maps extension and fallback formats to CSS descriptors', () => {
  assert.equal(fontFormatFromUrl('https://cdn/s/font.woff2?v=1'), 'woff2');
  assert.equal(fontFormatFromUrl('https://cdn/d/font.otf'), 'opentype');
  assert.equal(fontFormatFromUrl('https://cdn/d/font.ttf'), 'truetype');
  assert.equal(fontFormatFromUrl('https://cdn/s/noext', 'OTF'), 'opentype');
});
