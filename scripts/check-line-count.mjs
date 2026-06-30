#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_CODE_LINES = 100;

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']);
const IGNORED_DIRS = new Set(['.git', '.next', '.vercel', 'coverage', 'dist', 'node_modules']);
const GENERATED_DIRS = new Set(['functions/lib']);

function toRelativePath(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function isIgnoredDirectory(rootDir, directoryPath) {
  const relativePath = toRelativePath(rootDir, directoryPath);
  if (!relativePath) return false;
  if (IGNORED_DIRS.has(path.basename(directoryPath))) return true;
  return GENERATED_DIRS.has(relativePath);
}

export function isCodeFile(filePath) {
  return CODE_EXTENSIONS.has(path.extname(filePath));
}

export function countCodeLines(source) {
  return source.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

export function collectCodeFiles(rootDir = process.cwd()) {
  const files = [];

  function walk(currentPath) {
    const stat = fs.statSync(currentPath);

    if (stat.isDirectory()) {
      if (isIgnoredDirectory(rootDir, currentPath)) return;
      for (const entry of fs.readdirSync(currentPath)) {
        walk(path.join(currentPath, entry));
      }
      return;
    }

    if (stat.isFile() && isCodeFile(currentPath)) {
      files.push(toRelativePath(rootDir, currentPath));
    }
  }

  walk(rootDir);
  return files.sort();
}

export function findLineCountViolations(rootDir = process.cwd(), maxLines = MAX_CODE_LINES) {
  return collectCodeFiles(rootDir)
    .map((file) => ({
      file,
      lineCount: countCodeLines(fs.readFileSync(path.join(rootDir, file), 'utf8')),
      maxLines,
    }))
    .filter((result) => result.lineCount > maxLines);
}

function formatViolation({ file, lineCount, maxLines }) {
  return `${file}: ${lineCount} source lines (max ${maxLines})`;
}

export function checkLineCounts(rootDir = process.cwd(), maxLines = MAX_CODE_LINES) {
  const violations = findLineCountViolations(rootDir, maxLines);

  if (violations.length > 0) {
    console.error(`Line-count lint failed: ${violations.length} file(s) exceed ${maxLines} source lines.`);
    for (const violation of violations) {
      console.error(`- ${formatViolation(violation)}`);
    }
    console.error('Split large files into smaller modules, fixtures, helpers, or colocated components.');
  }

  return violations;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) {
  process.exitCode = checkLineCounts().length > 0 ? 1 : 0;
}
