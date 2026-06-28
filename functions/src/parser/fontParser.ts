import * as functions from "firebase-functions";
import { loadFont } from "./loadFont";
import { extractNaming } from "./naming";
import { readOS2, readNameExtras, readFeatures, readColorAndPost } from "./tables";
import { readGlyphCoverage, readLanguageSupport } from "./glyphs";
import { generateFingerprint, buildProvenance } from "./provenance";

/** Parse a font file server-side into a flat metadata record (loose shape).
 *  Orchestrates per-table extractors in ./parser/*; returns null if parsing fails. */
export async function serverParseFontFile(
  fileBuffer: Buffer,
  originalFilename: string
): Promise<any | null> {
  functions.logger.info(`Attempting to parse ${originalFilename}...`);

  const loaded = loadFont(fileBuffer, originalFilename);
  if (!loaded) return null;
  const { font, format } = loaded;

  const naming = extractNaming(font);
  const os2 = readOS2(font, { weight: naming.weight, foundry: naming.foundry });
  const nameExtras = readNameExtras(font);
  const { glyphCount, characterSetCoverage } = readGlyphCoverage(font);
  const languageSupport = readLanguageSupport(font);
  const { openTypeFeatures, kerningPairCount } = readFeatures(font);
  const { color, isFixedPitch, italicAngle } = readColorAndPost(font);

  const fingerprint = generateFingerprint({
    familyName: naming.familyName,
    version: naming.version,
    vendorId: os2.vendorId,
    panose: os2.panose,
    glyphCount,
  });
  const provenance = buildProvenance({
    foundry: os2.foundry,
    designer: nameExtras.designer,
    licenseDescription: nameExtras.licenseDescription,
  });

  functions.logger.info(
    `Parsed ${originalFilename}: Family='${naming.familyName}', Subfamily='${naming.subfamilyName}', ` +
      `Format='${format}', Foundry='${os2.foundry}', Glyphs=${glyphCount || "N/A"}`
  );

  return {
    familyName: naming.familyName,
    subfamilyName: naming.subfamilyName,
    postScriptName: naming.postScriptName,
    version: naming.version,
    copyright: naming.copyright,
    trademark: naming.trademark,
    foundry: os2.foundry,
    format,
    weight: os2.weight,
    style: naming.style || (naming.lowerSubfamily.includes("italic") ? "Italic" : "Regular"),
    isVariable: naming.isVariable,
    variableAxes: naming.variableAxes,
    classification: os2.classification || "Sans Serif",
    designer: nameExtras.designer,
    description: nameExtras.description,
    licenseUrl: nameExtras.licenseUrl,
    licenseDescription: nameExtras.licenseDescription,
    url: nameExtras.url,
    sampleText: nameExtras.sampleText,
    preferredFamily: nameExtras.preferredFamily,
    fullName: nameExtras.fullName,
    vendorId: os2.vendorId,
    panose: os2.panose,
    xHeight: os2.xHeight,
    capHeight: os2.capHeight,
    typoAscender: os2.typoAscender,
    typoDescender: os2.typoDescender,
    fsType: os2.fsType,
    unicodeRanges: os2.unicodeRanges,
    codepageRanges: os2.codepageRanges,
    glyphCount,
    characterSetCoverage,
    languageSupport,
    openTypeFeatures,
    kerningPairCount,
    isFixedPitch,
    italicAngle,
    color,
    fingerprint,
    provenance,
  };
}
