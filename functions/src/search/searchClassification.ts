export function canonicalSearchClassification(value: unknown): string | null {
  if (value === "Serif") return "Serif";
  if (value === "Sans Serif") return "Sans Serif";
  if (value === "Script & Handwriting") return "Script & Handwriting";
  if (value === "Monospace") return "Monospace";
  if (value === "Display & Decorative") return "Display & Decorative";
  if (value === "Symbol & Icon") return "Symbol & Icon";
  if (typeof value !== "string") return null;
  const text = value.toLowerCase();
  if (/\b(symbol|icon)\b/.test(text)) return "Symbol & Icon";
  if (/\b(mono|monospace|code)\b/.test(text)) return "Monospace";
  if (/\b(script|handwriting|handwritten|cursive)\b/.test(text)) return "Script & Handwriting";
  if (/\bsans\b/.test(text)) return "Sans Serif";
  if (/\bserif\b/.test(text)) return "Serif";
  if (/\b(display|decorative|ornamental)\b/.test(text)) return "Display & Decorative";
  return null;
}
