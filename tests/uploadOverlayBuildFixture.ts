import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const roots: string[] = [];
const chunk = 'static/chunks/upload-center-modal.turbopack.js';

export function writeOverlayFixture(entryFiles: string[], registered = true, unrelated = false): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-overlay-boundary-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'static/chunks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'server/app/page'), { recursive: true });
  fs.writeFileSync(path.join(root, chunk), 'seriph-upload-center-modal', 'utf8');
  const manifest = {
    clientModules: unrelated ? { modal: [chunk] } : {},
    entryJSFiles: { '[project]/app/page': entryFiles },
  };
  fs.writeFileSync(
    path.join(root, 'server/app/page_client-reference-manifest.js'),
    `globalThis.__RSC_MANIFEST=${JSON.stringify(manifest)};`,
    'utf8'
  );
  const loadable = registered ? { '123': { id: 123, files: [chunk] } } : {};
  fs.writeFileSync(
    path.join(root, 'server/app/page/react-loadable-manifest.json'),
    JSON.stringify(loadable),
    'utf8'
  );
  return root;
}

export function runOverlayVerifier(buildDir: string): string {
  return execFileSync(process.execPath, ['scripts/check-upload-overlay-boundary.mjs', buildDir], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

export function removeOverlayFixtures() {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
}

export const modalAsset = chunk;
