declare module 'wawoff2' {
  /** Compress an sfnt (TTF/OTF) buffer to woff2. */
  export function compress(input: Uint8Array | Buffer): Promise<Uint8Array>;
  /** Decompress a woff2 buffer back to sfnt. */
  export function decompress(input: Uint8Array | Buffer): Promise<Uint8Array>;
}
