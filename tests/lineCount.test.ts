import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkLineCounts,
  collectCodeFiles,
  countCodeLines,
  findLineCountWarnings,
  findLineCountViolations,
  isCodeFile,
} from '@/scripts/check-line-count.mjs';

const tempDirs: string[] = [];

function makeTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seriph-line-count-'));
  tempDirs.push(dir);
  return dir;
}

function writeFile(rootDir: string, relativePath: string, source: string) {
  const fullPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, source);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

describe('line-count lint helpers', () => {
  it('counts non-empty source lines', () => {
    expect(countCodeLines('const a = 1;\n\n  \nconst b = 2;\n')).toBe(2);
  });

  it('recognizes app code extensions', () => {
    expect(isCodeFile('component.tsx')).toBe(true);
    expect(isCodeFile('styles.css')).toBe(true);
    expect(isCodeFile('README.md')).toBe(false);
  });

  it('collects source files while ignoring generated and vendor trees', () => {
    const root = makeTempRepo();
    writeFile(root, 'app/page.tsx', 'export default function Page() { return null; }');
    writeFile(root, 'functions/lib/index.js', 'generated();');
    writeFile(root, 'node_modules/pkg/index.js', 'vendor();');

    expect(collectCodeFiles(root)).toEqual(['app/page.tsx']);
  });

  it('reports files over the configured limit', () => {
    const root = makeTempRepo();
    writeFile(root, 'lib/small.ts', 'one\n\n');
    writeFile(root, 'lib/large.ts', 'one\ntwo\nthree\n');

    expect(findLineCountViolations(root, 2)).toEqual([
      { file: 'lib/large.ts', lineCount: 3, maxLines: 2 },
    ]);
  });

  it('warns above one hundred lines and fails only above one hundred fifty', () => {
    const root = makeTempRepo();
    writeFile(root, 'lib/warning.ts', Array.from({ length: 101 }, (_, index) => `line${index}`).join('\n'));
    writeFile(root, 'lib/failure.ts', Array.from({ length: 151 }, (_, index) => `line${index}`).join('\n'));

    expect(findLineCountWarnings(root)).toEqual([
      { file: 'lib/warning.ts', lineCount: 101, warningLines: 100, maxLines: 150 },
    ]);
    expect(findLineCountViolations(root)).toEqual([
      { file: 'lib/failure.ts', lineCount: 151, maxLines: 150 },
    ]);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(checkLineCounts(root)).toEqual([{ file: 'lib/failure.ts', lineCount: 151, maxLines: 150 }]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('warnings'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('lib/warning.ts: 101 source lines (warning threshold 100)'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('failed'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('lib/failure.ts: 151 source lines'));
    warn.mockRestore();
    error.mockRestore();
  });
});
