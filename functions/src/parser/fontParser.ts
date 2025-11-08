import * as functions from "firebase-functions";
import * as fontkit from 'fontkit';
import * as opentype from 'opentype.js';
import * as crypto from 'crypto';
import type { FontFormat, DataProvenance } from '../models/font.models';

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

// Helper to create provenance entry
function createProvenance(
    sourceType: 'computed' | 'extracted' | 'web' | 'inferred',
    sourceRef?: string,
    method?: string,
    confidence: number = 1.0
): DataProvenance {
    return {
        source_type: sourceType,
        source_ref: sourceRef,
        timestamp: new Date().toISOString(),
        method,
        confidence,
    };
}

// Helper to generate fingerprint from font data
function generateFingerprint(fontData: any): string {
    const components = [
        fontData.familyName || '',
        fontData.version || '',
        fontData.vendorId || '',
        fontData.panose ? JSON.stringify(fontData.panose) : '',
        fontData.glyphCount || 0,
    ];
    const hash = crypto.createHash('sha256').update(components.join('|')).digest('hex');
    return hash.substring(0, 32); // Use first 32 chars
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

  // Enhanced OS/2 table extraction
  let vendorId: string | undefined;
  let panose: number[] | undefined;
  let xHeight: number | undefined;
  let capHeight: number | undefined;
  let typoAscender: number | undefined;
  let typoDescender: number | undefined;
  let fsType: number | undefined;
  let unicodeRanges: string[] = [];
  let codepageRanges: string[] = [];

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
    if (!foundry && os2Table.achVendID) {
        foundry = os2Table.achVendID;
        vendorId = os2Table.achVendID;
    }
    if (os2Table.achVendID) vendorId = os2Table.achVendID;
    if (os2Table.panose) panose = Array.from(os2Table.panose);
    if (os2Table.sxHeight) xHeight = os2Table.sxHeight;
    if (os2Table.sCapHeight) capHeight = os2Table.sCapHeight;
    if (os2Table.sTypoAscender) typoAscender = os2Table.sTypoAscender;
    if (os2Table.sTypoDescender) typoDescender = os2Table.sTypoDescender;
    if (os2Table.fsType !== undefined) fsType = os2Table.fsType;
    if (os2Table.ulUnicodeRange1 !== undefined || os2Table.ulUnicodeRange2 !== undefined) {
        // Convert Unicode ranges to hex strings
        const range1 = os2Table.ulUnicodeRange1 || 0;
        const range2 = os2Table.ulUnicodeRange2 || 0;
        const range3 = os2Table.ulUnicodeRange3 || 0;
        const range4 = os2Table.ulUnicodeRange4 || 0;
        // Simplified: store as array of range indicators
        unicodeRanges = [`U+${range1.toString(16)}`, `U+${range2.toString(16)}`, `U+${range3.toString(16)}`, `U+${range4.toString(16)}`];
    }
  }

  // Enhanced name table extraction
  let designer: string | undefined;
  let description: string | undefined;
  let licenseUrl: string | undefined;
  let licenseDescription: string | undefined;
  let url: string | undefined;
  let sampleText: string | undefined;
  let preferredFamily: string | undefined;
  let fullName: string | undefined;

  if ('names' in font && font.names) {
    const names = font.names as any;
    if (names.designer?.en) designer = names.designer.en;
    if (names.description?.en) description = names.description.en;
    if (names.licenseURL?.en) licenseUrl = names.licenseURL.en;
    if (names.licenseDescription?.en) licenseDescription = names.licenseDescription.en;
    if (names.manufacturerURL?.en) url = names.manufacturerURL.en;
    if (names.sampleText?.en) sampleText = names.sampleText.en;
    if (names.preferredFamily?.en) preferredFamily = names.preferredFamily.en;
    if (names.fullName?.en) fullName = names.fullName.en;
  }

  // Extract glyph count and character set
  let glyphCount: number | undefined;
  let characterSetCoverage: string[] = [];
  let languageSupport: string[] = [];

  // Collect Unicode code points from glyphs
  const codePoints = new Set<number>();

  if ('glyphs' in font && font.glyphs) {
    const glyphs = font.glyphs as any;
    glyphCount = Array.isArray(glyphs) ? glyphs.length : Object.keys(glyphs).length;
    
    // Extract Unicode code points from glyphs
    const glyphArray = Array.isArray(glyphs) ? glyphs : Object.values(glyphs);
    glyphArray.forEach((glyph: any) => {
      // Fontkit glyphs have 'unicode' property
      if (glyph && typeof glyph.unicode === 'number' && glyph.unicode >= 0) {
        codePoints.add(glyph.unicode);
      }
      // Some glyphs have 'codePoints' array
      else if (glyph && Array.isArray(glyph.codePoints)) {
        glyph.codePoints.forEach((cp: number) => {
          if (cp >= 0) codePoints.add(cp);
        });
      }
      // Opentype.js glyphs have 'unicode' property
      else if (glyph && glyph.unicode !== undefined && typeof glyph.unicode === 'number' && glyph.unicode >= 0) {
        codePoints.add(glyph.unicode);
      }
    });
  } else if ('characterSet' in font && font.characterSet) {
    const chars = font.characterSet as any;
    glyphCount = Array.isArray(chars) ? chars.length : 0;
    // Extract Unicode ranges from character set
    if (Array.isArray(chars)) {
      chars.forEach((char: any) => {
        const code = typeof char === 'number' ? char : (typeof char === 'string' ? char.codePointAt(0) : null);
        if (code !== null && code !== undefined && code >= 0) {
          codePoints.add(code);
        }
      });
    }
  }

  // Convert code points to Unicode ranges
  if (codePoints.size > 0) {
    const sortedCodes = Array.from(codePoints).sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sortedCodes[0];
    let end = start;

    for (let i = 1; i < sortedCodes.length; i++) {
      if (sortedCodes[i] === end + 1) {
        end = sortedCodes[i];
      } else {
        // End current range and start new one
        if (start === end) {
          ranges.push(`U+${start.toString(16).toUpperCase().padStart(4, '0')}`);
        } else {
          ranges.push(`U+${start.toString(16).toUpperCase().padStart(4, '0')}-U+${end.toString(16).toUpperCase().padStart(4, '0')}`);
        }
        start = sortedCodes[i];
        end = start;
      }
    }
    // Add final range
    if (start === end) {
      ranges.push(`U+${start.toString(16).toUpperCase().padStart(4, '0')}`);
    } else {
      ranges.push(`U+${start.toString(16).toUpperCase().padStart(4, '0')}-U+${end.toString(16).toUpperCase().padStart(4, '0')}`);
    }
    characterSetCoverage = ranges;
  }

  // Extract language support from name table language IDs
  if ('names' in font && font.names) {
    const names = font.names as any;
    const langIds = new Set<number>();
    Object.keys(names).forEach(key => {
        Object.keys(names[key] || {}).forEach(lang => {
            const langId = parseInt(lang, 10);
            if (!isNaN(langId)) langIds.add(langId);
        });
    });
    // Map common language IDs to ISO codes (simplified)
    languageSupport = Array.from(langIds).map(id => {
        // Common mappings (simplified - would need full table)
        if (id === 1033) return 'en';
        if (id === 1031) return 'de';
        if (id === 1036) return 'fr';
        if (id === 1041) return 'ja';
        return `lang_${id}`;
    });
  }

  // Extract OpenType features
  let openTypeFeatures: string[] = [];
  if ('GSUB' in font && font.GSUB) {
    const gsub = font.GSUB as any;
    if (gsub.features) {
        openTypeFeatures = Object.keys(gsub.features);
    }
  }
  if ('GPOS' in font && font.GPOS) {
    const gpos = font.GPOS as any;
    if (gpos.features) {
        openTypeFeatures = [...openTypeFeatures, ...Object.keys(gpos.features)];
    }
  }
  // Remove duplicates
  openTypeFeatures = [...new Set(openTypeFeatures)];

  // Extract kerning pairs count
  let kerningPairCount: number | undefined;
  if ('kern' in font && font.kern) {
    const kern = font.kern as any;
    if (kern.kerningPairs) {
        kerningPairCount = Object.keys(kern.kerningPairs).length;
    }
  } else if ('GPOS' in font && font.GPOS) {
    const gpos = font.GPOS as any;
    if (gpos.kerningPairs) {
        kerningPairCount = Object.keys(gpos.kerningPairs).length;
    }
  }

  // Detect color fonts
  const colorFormats: string[] = [];
  let colorLayerCount: number | undefined;
  let colorPaletteCount: number | undefined;
  if ('COLR' in font) colorFormats.push('COLR');
  if ('CPAL' in font) {
    colorFormats.push('CPAL');
    const cpal = (font as any).CPAL;
    if (cpal && cpal.palettes) colorPaletteCount = cpal.palettes.length;
  }
  if ('CBDT' in font || 'CBLC' in font) colorFormats.push('CBDT');
  if ('sbix' in font) colorFormats.push('sbix');
  if ('SVG' in font) colorFormats.push('SVG');
  if (colorFormats.includes('COLR') && (font as any).COLR) {
    const colr = (font as any).COLR;
    if (colr.layers) colorLayerCount = colr.layers.length;
  }

  // Detect fixed pitch
  let isFixedPitch: boolean | undefined;
  let italicAngle: number | undefined;
  if ('post' in font && font.post) {
    const post = font.post as any;
    if (post.isFixedPitch !== undefined) isFixedPitch = post.isFixedPitch;
    if (post.italicAngle !== undefined) italicAngle = post.italicAngle;
  }

  // Generate fingerprint
  const fingerprint = generateFingerprint({
    familyName,
    version,
    vendorId,
    panose,
    glyphCount,
  });

  // Build provenance map
  const provenance: { [key: string]: DataProvenance[] } = {};
  const now = new Date().toISOString();
  
  provenance.familyName = [createProvenance('extracted', 'name#1', 'fontkit_parser', 1.0)];
  provenance.version = [createProvenance('extracted', 'name#5', 'fontkit_parser', 1.0)];
  if (foundry) provenance.foundry = [createProvenance('extracted', 'name#8', 'fontkit_parser', 0.9)];
  if (designer) provenance.designer = [createProvenance('extracted', 'name#9', 'fontkit_parser', 0.9)];
  if (licenseDescription) provenance.license = [createProvenance('extracted', 'name#13', 'fontkit_parser', 0.8)];

  functions.logger.info(`Parsed ${originalFilename}: Family='${familyName}', Subfamily='${subfamilyName}', Format='${format}', Foundry='${foundry}', Glyphs=${glyphCount || 'N/A'}`);
  
  return {
      familyName,
      subfamilyName,
      postScriptName,
      version,
      copyright,
      trademark,
      foundry,
      format,
      weight,
      style: style || (lowerSubfamily.includes('italic') ? 'Italic' : 'Regular'),
      isVariable,
      variableAxes,
      classification: classification || 'Sans Serif',
      // Enhanced fields
      designer,
      description,
      licenseUrl,
      licenseDescription,
      url,
      sampleText,
      preferredFamily,
      fullName,
      vendorId,
      panose,
      xHeight,
      capHeight,
      typoAscender,
      typoDescender,
      fsType,
      unicodeRanges,
      codepageRanges,
      glyphCount,
      characterSetCoverage,
      languageSupport,
      openTypeFeatures,
      kerningPairCount,
      isFixedPitch,
      italicAngle,
      color: {
          present: colorFormats.length > 0,
          formats: colorFormats,
          layer_count: colorLayerCount,
          palette_count: colorPaletteCount,
      },
      fingerprint,
      provenance,
  };
}
