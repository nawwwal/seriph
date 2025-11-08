import * as functions from "firebase-functions";
import * as fontkit from 'fontkit';
import * as opentype from 'opentype.js';
import type { VisualMetrics, DataProvenance } from '../models/font.models';

// Helper to create provenance entry
function createProvenance(
    sourceType: 'computed' | 'extracted' | 'web' | 'inferred',
    method?: string,
    confidence: number = 1.0
): DataProvenance {
    return {
        source_type: sourceType,
        timestamp: new Date().toISOString(),
        method,
        confidence,
    };
}

/**
 * Compute visual metrics from font file tables
 * Simplified approach: extracts measurable metrics directly from font metadata
 * No rendering required - all metrics come from font tables (OS/2, post, etc.)
 */
export async function computeVisualMetrics(
    font: fontkit.Font | opentype.Font,
    parsedData: any
): Promise<VisualMetrics> {
    const metrics: VisualMetrics = {};

    try {
        // Get unitsPerEm for normalization
        const unitsPerEm = (font as any)?.unitsPerEm || (font as opentype.Font)?.unitsPerEm || 1000;

        // 1. X-height ratio (from OS/2 table)
        if (parsedData.xHeight) {
            metrics.x_height_ratio = parsedData.xHeight / unitsPerEm;
        } else if (parsedData.capHeight) {
            // Fallback estimate: x-height is typically ~70% of cap height
            metrics.x_height_ratio = (parsedData.capHeight * 0.7) / unitsPerEm;
        }

        // 2. Serif detection (from OS/2 sFamilyClass)
        metrics.serif_detected = parsedData.classification === 'Serif';

        // 3. Stress angle (from post table italic angle)
        metrics.stress_angle_deg = parsedData.italicAngle || 0;

        // 4. Terminal style (inferred from classification)
        if (parsedData.classification === 'Serif') {
            metrics.terminal_style = 'bracketed';
        } else if (parsedData.classification === 'Sans Serif') {
            metrics.terminal_style = 'sheared';
        } else {
            metrics.terminal_style = 'unknown';
        }

        // 5. Contrast index (estimated from weight and classification)
        if (parsedData.weight) {
            if (parsedData.classification === 'Serif') {
                // Serif fonts: higher contrast, varies with weight
                metrics.contrast_index = Math.max(0.1, Math.min(0.5, (900 - parsedData.weight) / 1000));
            } else {
                // Sans-serif fonts: lower contrast
                metrics.contrast_index = Math.max(0.05, Math.min(0.3, (900 - parsedData.weight) / 2000));
            }
        }

        // 6. Aperture index (estimated from x-height ratio)
        if (metrics.x_height_ratio) {
            // Higher x-height often means more open apertures
            metrics.aperture_index = Math.max(0.3, Math.min(0.8, metrics.x_height_ratio * 1.2));
        }

        // 7. Roundness (estimated from classification)
        metrics.roundness = parsedData.classification === 'Sans Serif' ? 0.5 : 0.3;

        // 8. Spacing stddev (estimated from classification and weight)
        if (parsedData.classification === 'Monospace') {
            metrics.spacing_stddev = 0.0; // Monospace has zero variance
        } else if (parsedData.weight) {
            const baseStdDev = 0.08;
            const weightFactor = (900 - parsedData.weight) / 1000;
            metrics.spacing_stddev = baseStdDev * (0.5 + weightFactor);
        }

        functions.logger.info(`Computed visual metrics from font tables`);
        return metrics;

    } catch (error: any) {
        functions.logger.error(`Error computing visual metrics: ${error.message}`);
        // Return minimal metrics on error
        return {
            serif_detected: parsedData.classification === 'Serif',
            stress_angle_deg: parsedData.italicAngle || 0,
        };
    }
}
