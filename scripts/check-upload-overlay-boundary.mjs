import fs from 'node:fs';
import path from 'node:path';
import { entryJsFiles, loadableFiles, normalizeAsset } from './uploadOverlayManifest.mjs';

const marker = 'seriph-upload-center-modal';

function findFiles(root, matches) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(root, entry.name);
    return entry.isDirectory() ? findFiles(filePath, matches) : matches(filePath) ? [filePath] : [];
  });
}

function fail(message) {
  throw new Error(`Upload overlay build boundary check failed: ${message}`);
}

function filesContaining(files, asset, readAssets) {
  return files.filter((filePath) => readAssets(fs.readFileSync(filePath, 'utf8')).includes(asset));
}

function main(buildDir = path.join(process.cwd(), '.next')) {
  const chunksDir = path.join(buildDir, 'static/chunks');
  const modalChunks = findFiles(chunksDir, (filePath) => filePath.endsWith('.js')).filter((filePath) =>
    fs.readFileSync(filePath, 'utf8').includes(marker)
  );
  if (modalChunks.length !== 1) {
    fail(`expected exactly one modal chunk containing the stable marker, found ${modalChunks.length}. Run npm run build first.`);
  }

  const modalAsset = normalizeAsset(path.relative(buildDir, modalChunks[0]));
  const manifestsDir = path.join(buildDir, 'server/app');
  const routes = findFiles(manifestsDir, (filePath) => filePath.endsWith('_client-reference-manifest.js'));
  if (routes.length === 0) fail('no route client-reference manifests were found. Run npm run build first.');

  const initialRoutes = filesContaining(routes, modalAsset, entryJsFiles);
  if (initialRoutes.length > 0) {
    fail(`Upload Center modal was included in initial route bundle(s): ${initialRoutes.map((file) => path.relative(manifestsDir, file)).join(', ')}`);
  }

  const loadables = findFiles(buildDir, (filePath) => filePath.endsWith('react-loadable-manifest.json'));
  if (filesContaining(loadables, modalAsset, loadableFiles).length === 0) {
    fail('Upload Center modal chunk is not registered in any react-loadable manifest.');
  }

  console.log(`Upload Center modal remains deferred: /_next/${modalAsset}`);
  console.log(`Checked ${routes.length} route client-reference manifests and ${loadables.length} loadable manifests.`);
}

try {
  main(process.argv[2]);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
