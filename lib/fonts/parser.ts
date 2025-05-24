import * as fontkit from 'fontkit';
import * as opentype from 'opentype.js';
import { Font, FontFamily, FontMetadata, FontFormat, FontStyle, VariableAxis } from '@/models/font.models'; // Adjust path as needed

interface ParsedFontData {
    familyName: string;
    subfamilyName: string;
    postScriptName: string;
    version: string;
    copyright: string;
    trademark: string;
    format: FontFormat;
    // TODO: Add more extracted fields
}

// Helper to attempt to guess format from filename if buffer parsing fails or is ambiguous
function guessFormatFromFilename(filename: string): FontFormat | undefined {
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

export async function parseFontFile(buffer: ArrayBuffer, filename: string): Promise<ParsedFontData | null> {
    let font: fontkit.Font | opentype.Font | null = null;
    let detectedFormat: FontFormat | undefined;

    try {
        // Attempt with fontkit first (good for WOFF, WOFF2, and general metadata)
        const fkFont = fontkit.create(Buffer.from(buffer));
        if (fkFont) {
            font = fkFont;
            // Fontkit doesn't directly tell us WOFF vs WOFF2 in a simple property often
            // We might infer from magic numbers or rely on filename for initial distinction if needed
            // For now, let's try a crude check or rely on filename guess later
            if (filename.toLowerCase().endsWith('.woff2')) detectedFormat = 'WOFF2';
            else if (filename.toLowerCase().endsWith('.woff')) detectedFormat = 'WOFF';
            else if (filename.toLowerCase().endsWith('.ttf')) detectedFormat = 'TTF';
            else if (filename.toLowerCase().endsWith('.otf')) detectedFormat = 'OTF';
        }
    } catch (e) {
        // console.warn(`Fontkit failed for ${filename}:`, e);
        // If fontkit fails, try opentype.js (good for TTF/OTF)
        try {
            const otFont = opentype.parse(buffer);
            if (otFont) {
                font = otFont;
                // opentype.js is primarily for TTF/OTF
                // We need to be careful about format detection here
                if (otFont.outlinesFormat === 'truetype') detectedFormat = 'TTF';
                else if (otFont.outlinesFormat === 'cff') detectedFormat = 'OTF';
            }
        } catch (e2) {
            console.error(`Both fontkit and opentype.js failed to parse ${filename}:`, e2);
            return null;
        }
    }

    if (!font) {
        console.error(`Could not parse font: ${filename}`);
        return null;
    }

    const format = detectedFormat || guessFormatFromFilename(filename) || 'TTF'; // Default or throw error?

    // --- Extracting data ---
    // Note: field names vary between fontkit and opentype.js
    // We need to normalize them.

    let familyName = 'Unknown Family';
    let subfamilyName = 'Regular';
    let postScriptName = 'UnknownPSName';
    let version = 'N/A';
    let copyright = 'N/A';
    let trademark = 'N/A';

    if ('familyName' in font && typeof font.familyName === 'string') {
        familyName = font.familyName;
    }
    // opentype.js uses names.fontFamily
    else if ('names' in font && font.names.fontFamily && font.names.fontFamily.en) {
         familyName = font.names.fontFamily.en;
    }

    if ('subfamilyName' in font && typeof font.subfamilyName === 'string') {
        subfamilyName = font.subfamilyName;
    }
    // opentype.js uses names.fontSubfamily
    else if ('names' in font && font.names.fontSubfamily && font.names.fontSubfamily.en) {
        subfamilyName = font.names.fontSubfamily.en;
    }

    if ('postscriptName' in font && typeof font.postscriptName === 'string') {
        postScriptName = font.postscriptName;
    }
    // opentype.js uses names.postScriptName
    else if ('names' in font && font.names.postScriptName && font.names.postScriptName.en) {
        postScriptName = font.names.postScriptName.en;
    }

    if ('version' in font && typeof font.version === 'string') { // fontkit often has full version string
        version = font.version;
    }
    // opentype.js names.version
    else if ('names' in font && font.names.version && font.names.version.en) {
        version = font.names.version.en;
    }

    if ('copyright' in font && typeof font.copyright === 'string') {
        copyright = font.copyright;
    }
    else if ('names' in font && font.names.copyright && font.names.copyright.en) {
        copyright = font.names.copyright.en;
    }

    if ('trademark' in font && typeof font.trademark === 'string') {
        trademark = font.trademark;
    }
    else if ('names' in font && font.names.trademark && font.names.trademark.en) {
        trademark = font.names.trademark.en;
    }


    // TODO: Extract more details like weight, style, isVariable, axes, OpenType features, etc.
    // This will require more in-depth use of fontkit/opentype.js APIs

    return {
        familyName,
        subfamilyName,
        postScriptName,
        version,
        copyright,
        trademark,
        format,
        // ... more fields
    };
}

// Example of how to use it later (e.g., in an API route or a worker)
// async function processUploadedFont(fileBuffer: ArrayBuffer, filename: string) {
//   const parsedData = await parseFontFile(fileBuffer, filename);
//   if (parsedData) {
//     console.log('Parsed Font Data:', parsedData);
//     // Next steps: save to Firestore, group families, etc.
//   } else {
//     console.log('Failed to parse font:', filename);
//   }
// }
