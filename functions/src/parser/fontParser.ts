import * as functions from "firebase-functions";
import * as fontkit from 'fontkit';
import * as opentype from 'opentype.js';
import type { FontFormat } from '../models/font.models'; // Corrected path

// Helper to attempt to guess format from filename
function guessFormatFromFilenameServer(filename: string): FontFormat | undefined {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'ttf': return 'TTF';
        case 'otf': return 'OTF';
        case 'woff': return 'WOFF';
        case 'woff2': return 'WOFF2';
        case 'eot': return 'EOT';
        default: return undefined;
    }
}

// serverParseFontFile: Implementation adapted from client-side parser.ts
export async function serverParseFontFile(
  fileBuffer: Buffer,
  originalFilename: string
): Promise<any | null> {
  functions.logger.info(`Attempting to parse ${originalFilename}...`);
  let font: fontkit.Font | opentype.Font | null = null;
  let detectedFormat: FontFormat | undefined;

  try {
      const fkResult = fontkit.create(fileBuffer);
      if (fkResult) {
          if ('fonts' in fkResult && fkResult.fonts.length > 0) {
              font = fkResult.fonts[0];
          } else if ('postscriptName' in fkResult) {
              font = fkResult as fontkit.Font;
          }
          if (font) {
              if (originalFilename.toLowerCase().endsWith('.woff2')) detectedFormat = 'WOFF2';
              else if (originalFilename.toLowerCase().endsWith('.woff')) detectedFormat = 'WOFF';
              else if (originalFilename.toLowerCase().endsWith('.ttf')) detectedFormat = 'TTF';
              else if (originalFilename.toLowerCase().endsWith('.otf')) detectedFormat = 'OTF';
              else if (originalFilename.toLowerCase().endsWith('.eot')) detectedFormat = 'EOT';
          }
      }
  } catch (e: any) {
      functions.logger.warn(`Fontkit failed for ${originalFilename}: ${e.message}. Trying opentype.js...`);
      try {
          const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
          const otFont = opentype.parse(arrayBuffer);
          if (otFont) {
              font = otFont;
              if (otFont.outlinesFormat === 'truetype') detectedFormat = 'TTF';
              else if (otFont.outlinesFormat === 'cff') detectedFormat = 'OTF';
          }
      } catch (e2: any) {
          functions.logger.error(`Both fontkit and opentype.js failed to parse ${originalFilename}: Fontkit error: ${e.message}, Opentype error: ${e2.message}`);
          return null;
      }
  }

  if (!font) {
      functions.logger.error(`Could not parse font: ${originalFilename} with either library.`);
      return null;
  }

  const format = detectedFormat || guessFormatFromFilenameServer(originalFilename) || 'OTF';

  let familyName = 'Unknown Family';
  let subfamilyName = 'Regular';
  let postScriptName = 'UnknownPSName';
  let version = 'N/A';
  let copyright = 'N/A';
  let trademark = 'N/A';
  let weight: number | undefined;
  let style: string | undefined;
  let isVariable: boolean = false;
  let variableAxes: any[] = [];
  let classification: string | undefined;
  let foundry: string | undefined; // Added foundry

  if ('familyName' in font && typeof font.familyName === 'string') familyName = font.familyName;
  else if ('names' in font && font.names.fontFamily?.en) familyName = font.names.fontFamily.en;

  if ('subfamilyName' in font && typeof font.subfamilyName === 'string') subfamilyName = font.subfamilyName;
  else if ('names' in font && font.names.fontSubfamily?.en) subfamilyName = font.names.fontSubfamily.en;

  if ('postscriptName' in font && typeof font.postscriptName === 'string') postScriptName = font.postscriptName;
  else if ('names' in font && font.names.postScriptName?.en) postScriptName = font.names.postScriptName.en;

  if ('version' in font && typeof font.version === 'string') version = font.version;
  else if ('names' in font && font.names.version?.en) version = font.names.version.en;

  if ('copyright' in font && typeof font.copyright === 'string') copyright = font.copyright;
  else if ('names' in font && font.names.copyright?.en) copyright = font.names.copyright.en;

  if ('trademark' in font && typeof font.trademark === 'string') trademark = font.trademark;
  else if ('names' in font && font.names.trademark?.en) trademark = font.names.trademark.en;

  // Attempt to get Foundry
  if ('designer' in font && typeof font.designer === 'string') foundry = font.designer; // fontkit often uses 'designer'
  else if ('manufacturer' in font && typeof font.manufacturer === 'string') foundry = font.manufacturer; // fontkit
  else if ('names' in font && font.names.manufacturer?.en) foundry = font.names.manufacturer.en; // opentype

  const lowerSubfamily = subfamilyName.toLowerCase();
  if (lowerSubfamily.includes('italic')) style = 'Italic';
  if (lowerSubfamily.includes('bold')) weight = 700;
  else if (lowerSubfamily.includes('light')) weight = 300;
  else if (lowerSubfamily.includes('medium')) weight = 500;
  else if (lowerSubfamily.includes('black')) weight = 900;
  else if (lowerSubfamily.includes('thin')) weight = 100;
  else weight = 400;

  if ('variationAxes' in font && font.variationAxes) {
      isVariable = true;
      variableAxes = Object.entries(font.variationAxes).map(([tag, axis]) => ({
          tag: tag,
          name: (axis as any).name || tag,
          minValue: (axis as any).min,
          maxValue: (axis as any).max,
          defaultValue: (axis as any).default,
      }));
  }

  if ('OS2' in font && font.OS2) {
    const os2Table = font.OS2 as any;
    if (os2Table.sFamilyClass) {
        const mainClass = os2Table.sFamilyClass >> 8;
        if (mainClass === 1 || mainClass === 2 || mainClass === 3 || mainClass === 4 || mainClass === 5 || mainClass === 7) classification = "Serif";
        else if (mainClass === 8) classification = "Sans Serif";
        else if (mainClass === 9) classification = "Display & Decorative";
        else if (mainClass === 10) classification = "Script & Handwriting";
        else if (mainClass === 12) classification = "Symbol & Icon";
    }
    if (!weight && os2Table.usWeightClass) {
        weight = os2Table.usWeightClass;
    }
    if (!foundry && os2Table.achVendID) foundry = os2Table.achVendID;

  }
  functions.logger.info(`Parsed ${originalFilename}: Family='${familyName}', Subfamily='${subfamilyName}', Format='${format}', Foundry='${foundry}'`);
  return {
      familyName,
      subfamilyName,
      postScriptName,
      version,
      copyright,
      trademark,
      foundry, // Added
      format,
      weight,
      style: style || (lowerSubfamily.includes('italic') ? 'Italic' : 'Regular'),
      isVariable,
      variableAxes,
      classification: classification || 'Sans Serif',
  };
}
