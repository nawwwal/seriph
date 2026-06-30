import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const sourceRoots = ['app', 'components', 'styles', 'lib'];
const sourceExtensions = new Set(['.css', '.ts', '.tsx']);
const themeDefinitionPattern = /^styles\/themes-(?:core|bright|warm|places)\.css$/;

const rawColorPattern = /(?:#[0-9a-fA-F]{3,8}|%23[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^)]*\))/g;
const tailwindPalettePattern =
  /\b(?:bg|text|border|ring|outline|decoration|divide|from|via|to|accent|caret|fill|stroke)-(?:white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/g;
const fixedShadowPattern = /(?<![\w-])shadow(?:-(?:sm|md|lg|xl|2xl|inner))?\b/g;
const ringOffsetPattern = /\bring-offset(?:-\d+)?\b/g;

function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath);
    }
    return sourceExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

function lineForIndex(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function matchesFor(pattern: RegExp, content: string, file: string): string[] {
  return Array.from(content.matchAll(pattern), (match) => {
    const token = match[0];
    const line = lineForIndex(content, match.index ?? 0);
    return `${file}:${line} uses ${token}`;
  });
}

describe('theme color guard', () => {
  it('keeps visible app colors behind theme variables', () => {
    const violations = sourceRoots
      .flatMap((root) => walkFiles(path.join(repoRoot, root)))
      .flatMap((fullPath) => {
        const file = path.relative(repoRoot, fullPath);
        if (themeDefinitionPattern.test(file)) return [];

        const content = fs.readFileSync(fullPath, 'utf8');
        return [
          ...matchesFor(rawColorPattern, content, file),
          ...matchesFor(tailwindPalettePattern, content, file),
          ...matchesFor(fixedShadowPattern, content, file),
          ...matchesFor(ringOffsetPattern, content, file),
        ];
      });

    expect(violations).toEqual([]);
  });

  it('keeps skeleton and track fills as opacity of the foreground ink', () => {
    const themeFiles = ['themes-core.css', 'themes-bright.css', 'themes-warm.css', 'themes-places.css'];
    const mutedToken = '--muted: color-mix(in srgb, var(--ink) 16%, transparent);';

    for (const themeFile of themeFiles) {
      const content = fs.readFileSync(path.join(repoRoot, 'styles', themeFile), 'utf8');
      const mutedDeclarations = content.match(/--muted:\s*[^;]+;/g) ?? [];
      expect(mutedDeclarations.length).toBeGreaterThan(0);
      expect(new Set(mutedDeclarations)).toEqual(new Set([mutedToken]));
    }

    expect(fs.readFileSync(path.join(repoRoot, 'styles', 'utilities-base.css'), 'utf8'))
      .toContain('background: var(--control-track);');
    expect(fs.readFileSync(path.join(repoRoot, 'styles', 'utilities-decorative.css'), 'utf8'))
      .toContain('background: var(--control-track);');
  });

  it('keeps focus rings tied to foreground ink', () => {
    const themeFiles = ['themes-core.css', 'themes-bright.css', 'themes-warm.css', 'themes-places.css'];
    const focusToken = '--focus: var(--ink);';

    for (const themeFile of themeFiles) {
      const content = fs.readFileSync(path.join(repoRoot, 'styles', themeFile), 'utf8');
      const focusDeclarations = content.match(/--focus:\s*[^;]+;/g) ?? [];
      expect(focusDeclarations.length).toBeGreaterThan(0);
      expect(new Set(focusDeclarations)).toEqual(new Set([focusToken]));
    }

    expect(fs.readFileSync(path.join(repoRoot, 'styles', 'utilities-theme.css'), 'utf8'))
      .toContain('outline: 2px solid var(--focus);');
  });
});
