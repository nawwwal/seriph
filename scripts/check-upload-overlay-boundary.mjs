import fs from 'node:fs';
import path from 'node:path';

const marker = 'seriph-upload-center-modal';

function findFiles(root, matches) {
  if (!fs.existsSync(root)) return [];

  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...findFiles(filePath, matches));
    else if (matches(filePath)) files.push(filePath);
  }
  return files;
}

function fail(message) {
  throw new Error(`Upload overlay build boundary check failed: ${message}`);
}

function main(buildDir = path.join(process.cwd(), '.next')) {
  const chunksDir = path.join(buildDir, 'static/chunks');
  const manifestsDir = path.join(buildDir, 'server/app');
  const modalChunks = findFiles(chunksDir, (filePath) => filePath.endsWith('.js')).filter((filePath) =>
    fs.readFileSync(filePath, 'utf8').includes(marker)
  );

  if (modalChunks.length !== 1) {
    fail(
      `expected exactly one modal chunk containing the stable marker, found ${modalChunks.length}. Run npm run build first.`
    );
  }

  const modalChunk = modalChunks[0];
  const modalUrl = `/_next/${path.relative(buildDir, modalChunk).replaceAll(path.sep, '/')}`;
  const manifests = findFiles(manifestsDir, (filePath) => filePath.endsWith('_client-reference-manifest.js'));

  if (manifests.length === 0) {
    fail('no route client-reference manifests were found. Run npm run build first.');
  }

  const initialRoutes = manifests.filter((filePath) => fs.readFileSync(filePath, 'utf8').includes(modalUrl));
  if (initialRoutes.length > 0) {
    fail(
      `Upload Center modal was included in initial route bundle(s): ${initialRoutes
        .map((filePath) => path.relative(manifestsDir, filePath))
        .join(', ')}`
    );
  }

  console.log(`Upload Center modal remains deferred: ${modalUrl}`);
  console.log(`Checked ${manifests.length} route client-reference manifests.`);
}

try {
  main(process.argv[2]);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
