import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildCss2, renderFontFace, resolveFace, parseCss2Query, parseFamilySpec } = require("../../lib/serve/css2.js");
const { readGlyphCoverage } = require("../../lib/parser/glyphs.js");

test("parseFamilySpec rejects empty names and clamps invalid NaN weights", () => {
  assert.equal(parseFamilySpec("   "), null);
  const parsed = parseFamilySpec("Inter:wght@abc..def");
  assert.ok(parsed);
  assert.deepEqual(parsed.styles[0]?.weight, [400, 400]);
  assert.equal(parseCss2Query(new URLSearchParams("family=&family=Inter")).families.length, 1);
});

test("renderFontFace escapes CSS family names and handles dynamic italic variable axes", () => {
  const family = {
    id: "u1__garet",
    slug: "garet",
    name: "Garet's Sans",
    faces: [
      {
        id: "var",
        weight: 400,
        italic: false,
        isVariable: true,
        axes: [
          { tag: "wght", name: "Weight", min: 100, max: 900, default: 400 },
          { tag: "ital", name: "Italic", min: 0, max: 1, default: 0 },
        ],
        woff2: { url: "https://seriph.web.app/s/u1/garet.woff2" },
      },
    ],
  };

  const upright = resolveFace(family, { weight: 400, italic: false });
  const italic = resolveFace(family, { weight: 700, italic: true });
  assert.ok(upright && italic);

  const css = buildCss2(
    [{ slug: "garet", styles: [{ weight: 400, italic: false }, { weight: 700, italic: true }] }],
    "swap",
    (slug) => (slug === "garet" ? family : undefined),
  );
  assert.match(css, /font-family: 'Garet\\'s Sans';/);
  assert.match(css, /font-style: normal;/);
  assert.match(css, /font-style: italic;/);
  assert.match(css, /font-weight: 100 900;/);
});

test("readGlyphCoverage iterates opentype.js GlyphSet via .length and .get(i)", () => {
  const fakeGlyphs = {
    length: 4,
    get(index) {
      return [
        { unicode: 65, unicodes: [65] },
        { unicode: 66, unicodes: [66] },
        { unicode: 67, unicodes: [67] },
        { unicode: 97, unicodes: [97] },
      ][index];
    },
  };
  const coverage = readGlyphCoverage({ glyphs: fakeGlyphs });
  assert.equal(coverage.glyphCount, 4);
  assert.deepEqual(coverage.characterSetCoverage, ["U+0041-U+0043", "U+0061"]);
});
