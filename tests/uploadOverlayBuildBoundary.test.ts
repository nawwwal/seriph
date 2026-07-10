import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const verifier = path.join(repoRoot, 'scripts/check-upload-overlay-boundary.mjs');
const fixtureRoots: string[] = [];

function writeFixture({ modalIsInitial }: { modalIsInitial: boolean }): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-overlay-boundary-'));
  fixtureRoots.push(root);

  const chunks = path.join(root, 'static/chunks');
  const manifests = path.join(root, 'server/app');
  fs.mkdirSync(chunks, { recursive: true });
  fs.mkdirSync(manifests, { recursive: true });

  fs.writeFileSync(
    path.join(chunks, 'upload-center-modal.turbopack.js'),
    'jsx("div",{"data-upload-center-bundle":"seriph-upload-center-modal"})',
    'utf8'
  );
  fs.writeFileSync(
    path.join(manifests, 'page_client-reference-manifest.js'),
    modalIsInitial
      ? 'chunks:["/_next/static/chunks/upload-center-modal.turbopack.js"]'
      : 'chunks:["/_next/static/chunks/app-shell.turbopack.js"]',
    'utf8'
  );

  return root;
}

function runVerifier(buildDir: string): string {
  return execFileSync(process.execPath, [verifier, buildDir], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('upload overlay build boundary', () => {
  it('accepts a modal chunk that is absent from route manifests', () => {
    const output = runVerifier(writeFixture({ modalIsInitial: false }));

    expect(output).toContain('Upload Center modal remains deferred');
  });

  it('fails clearly when a route manifest includes the modal chunk', () => {
    expect(() => runVerifier(writeFixture({ modalIsInitial: true }))).toThrow(
      'Upload Center modal was included in initial route bundle(s): page_client-reference-manifest.js'
    );
  });
});
