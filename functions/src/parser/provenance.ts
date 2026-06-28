import * as crypto from "crypto";
import type { DataProvenance } from "../models/font.models";

export function createProvenance(
  sourceType: "computed" | "extracted" | "web" | "inferred",
  sourceRef?: string,
  method?: string,
  confidence = 1.0
): DataProvenance {
  return { source_type: sourceType, source_ref: sourceRef, timestamp: new Date().toISOString(), method, confidence };
}

export function generateFingerprint(fontData: any): string {
  const components = [
    fontData.familyName || "",
    fontData.version || "",
    fontData.vendorId || "",
    fontData.panose ? JSON.stringify(fontData.panose) : "",
    fontData.glyphCount || 0,
  ];
  return crypto.createHash("sha256").update(components.join("|")).digest("hex").substring(0, 32);
}

/** Provenance map for the fields we extract from the name/OS2 tables. */
export function buildProvenance(meta: { foundry?: string; designer?: string; licenseDescription?: string }) {
  const p: { [key: string]: DataProvenance[] } = {};
  p.familyName = [createProvenance("extracted", "name#1", "fontkit_parser", 1.0)];
  p.version = [createProvenance("extracted", "name#5", "fontkit_parser", 1.0)];
  if (meta.foundry) p.foundry = [createProvenance("extracted", "name#8", "fontkit_parser", 0.9)];
  if (meta.designer) p.designer = [createProvenance("extracted", "name#9", "fontkit_parser", 0.9)];
  if (meta.licenseDescription) p.license = [createProvenance("extracted", "name#13", "fontkit_parser", 0.8)];
  return p;
}
