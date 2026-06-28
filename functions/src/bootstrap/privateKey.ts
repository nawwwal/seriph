/** Normalize a PEM private key that may arrive base64-encoded, quoted, or with
 *  escaped newlines (varies by hosting platform). */
export function coercePrivateKey(input?: string | null): string | null {
  if (!input) return null;
  let pk = input.trim();
  const looksLikeBase64 = !pk.includes("BEGIN PRIVATE KEY") && /^[A-Za-z0-9+/=\s]+$/.test(pk);
  if (looksLikeBase64) {
    try {
      pk = Buffer.from(pk, "base64").toString("utf8");
    } catch {
      // fall back to raw
    }
  }
  pk = pk.replace(/\\n/g, "\n").replace(/^"+|"+$/g, "");
  pk = pk.replace(/^-*BEGIN PRIVATE KEY-*$/m, "-----BEGIN PRIVATE KEY-----");
  pk = pk.replace(/^-*END PRIVATE KEY-*$/m, "-----END PRIVATE KEY-----");
  pk = pk.replace(/(-----BEGIN PRIVATE KEY-----)([^\n])/, "$1\n$2");
  pk = pk.replace(/([^\n])(-----END PRIVATE KEY-----)/, "$1\n$2");
  if (!pk.endsWith("\n")) pk += "\n";
  return pk;
}
