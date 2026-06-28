function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Quick hash: SHA-256 of the first ≤2 MB combined with the file length. */
export async function computeQuickHash(buffer: ArrayBuffer): Promise<string> {
  const chunkSize = Math.min(2 * 1024 * 1024, buffer.byteLength);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer.slice(0, chunkSize));

  const lengthBuffer = new ArrayBuffer(8);
  new DataView(lengthBuffer).setBigUint64(0, BigInt(buffer.byteLength), true);

  const combined = new Uint8Array(hashBuffer.byteLength + lengthBuffer.byteLength);
  combined.set(new Uint8Array(hashBuffer), 0);
  combined.set(new Uint8Array(lengthBuffer), hashBuffer.byteLength);
  return toHex(await crypto.subtle.digest('SHA-256', combined));
}

/** Full SHA-256 of the entire file. */
export async function computeFullHash(buffer: ArrayBuffer): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', buffer));
}
