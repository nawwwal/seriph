#!/usr/bin/env node
/**
 * Fail if working-tree tracked files match high-signal secret patterns.
 * Complements GitGuardian; does not scan full git history.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const PATTERNS = [
  { name: 'PEM private key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub PAT', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'OpenAI-style key', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: 'service account private_key JSON', re: /"private_key"\s*:\s*"-----BEGIN/ },
];

const SKIP_PREFIX = ['docs/', 'plans/', '.agents/'];
const SKIP_FILE = new Set([
  'package-lock.json',
  'functions/package-lock.json',
  'scripts/check-no-secrets.mjs',
]);

function trackedFiles() {
  return execSync('git ls-files -z', { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter((f) => !SKIP_FILE.has(f) && !f.endsWith('.lock'))
    .filter((f) => !SKIP_PREFIX.some((p) => f.startsWith(p)));
}

function shouldSkipLine(file, line) {
  // Parser helpers mention PEM markers without embedding keys.
  if (file.endsWith('privateKey.ts') && (line.includes('includes(') || line.includes('replace'))) {
    return true;
  }
  return false;
}

const hits = [];
for (const file of trackedFiles()) {
  if (!fs.existsSync(file)) continue;
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (shouldSkipLine(file, line)) continue;
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) hits.push(`${file}:${i + 1}: ${name}`);
    }
  }
}

if (hits.length) {
  console.error('Secret-pattern check failed:\n' + hits.map((h) => `  - ${h}`).join('\n'));
  process.exit(1);
}
console.log(`Secret-pattern check passed (${trackedFiles().length} files).`);
