import path from 'node:path';

function objectEnd(source, start) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return index;
  }
  return -1;
}

function manifestObject(source, key) {
  const property = new RegExp(`(?:["']${key}["']|\\b${key}\\b)\\s*:`).exec(source);
  if (!property) return {};
  const start = source.indexOf('{', property.index + property[0].length);
  const end = start < 0 ? -1 : objectEnd(source, start);
  return end < 0 ? {} : JSON.parse(source.slice(start, end + 1));
}

export function normalizeAsset(asset) {
  const pathname = asset.split(/[?#]/, 1)[0].replaceAll('\\', '/').replace(/^\/+/, '');
  const relativePath = pathname.startsWith('_next/') ? pathname.slice('_next/'.length) : pathname;
  return path.posix.normalize(relativePath);
}

function normalizedFiles(files) {
  return files.filter((file) => typeof file === 'string').map(normalizeAsset);
}

export function entryJsFiles(source) {
  return normalizedFiles(
    Object.values(manifestObject(source, 'entryJSFiles')).flatMap((files) =>
      Array.isArray(files) ? files : []
    )
  );
}

export function loadableFiles(source) {
  return normalizedFiles(
    Object.values(JSON.parse(source) || {}).flatMap((entry) =>
      Array.isArray(entry?.files) ? entry.files : []
    )
  );
}
