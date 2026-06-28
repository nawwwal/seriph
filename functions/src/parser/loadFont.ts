import * as functions from "firebase-functions";
import * as fontkit from "fontkit";
import * as opentype from "opentype.js";
import type { FontFormat } from "../models/font.models";

export function guessFormatFromFilename(filename: string): FontFormat | undefined {
  switch (filename.split(".").pop()?.toLowerCase()) {
    case "ttf": return "TTF";
    case "otf": return "OTF";
    case "woff": return "WOFF";
    case "woff2": return "WOFF2";
    case "eot": return "EOT";
    default: return undefined;
  }
}

/** Parse a font with fontkit, falling back to opentype.js. Returns the font
 *  object (loose shape) and the detected format, or null if both fail. */
export function loadFont(
  fileBuffer: Buffer,
  originalFilename: string
): { font: any; format: FontFormat } | null {
  let font: fontkit.Font | opentype.Font | null = null;
  let detectedFormat: FontFormat | undefined;

  try {
    const fkResult = fontkit.create(fileBuffer);
    if (fkResult) {
      if ("fonts" in fkResult && fkResult.fonts.length > 0) font = fkResult.fonts[0];
      else if ("postscriptName" in fkResult) font = fkResult as fontkit.Font;
      if (font) detectedFormat = guessFormatFromFilename(originalFilename);
    }
  } catch (e: any) {
    functions.logger.warn(`Fontkit failed for ${originalFilename}: ${e.message}. Trying opentype.js...`);
    try {
      const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      );
      const otFont = opentype.parse(arrayBuffer);
      if (otFont) {
        font = otFont;
        if (otFont.outlinesFormat === "truetype") detectedFormat = "TTF";
        else if (otFont.outlinesFormat === "cff") detectedFormat = "OTF";
      }
    } catch (e2: any) {
      functions.logger.error(
        `Both parsers failed for ${originalFilename}: fontkit=${e.message}, opentype=${e2.message}`
      );
      return null;
    }
  }

  if (!font) {
    functions.logger.error(`Could not parse font: ${originalFilename} with either library.`);
    return null;
  }
  const format = detectedFormat || guessFormatFromFilename(originalFilename) || "OTF";
  return { font, format };
}
