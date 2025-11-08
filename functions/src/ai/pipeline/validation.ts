import * as functions from 'firebase-functions';
import { CLASSIFICATION_VALUES, Classification } from '../../models/font.models';
import { isValidMood, isValidUseCase, isValidSubtype } from '../taxonomies';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate AI analysis result structure and values
 */
export function validateAnalysisResult(result: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!result) {
    errors.push('Result is null or undefined');
    return { isValid: false, errors, warnings };
  }

  if (!result.style_primary || !result.style_primary.value) {
    errors.push('Missing style_primary.value');
  } else {
    // Validate classification enum
    if (!CLASSIFICATION_VALUES.includes(result.style_primary.value as Classification)) {
      errors.push(`Invalid classification: ${result.style_primary.value}`);
    }
  }

  // Validate substyle if present
  if (result.substyle && result.substyle.value) {
    if (result.style_primary && !isValidSubtype(result.style_primary.value, result.substyle.value)) {
      warnings.push(`Substyle ${result.substyle.value} may not be valid for ${result.style_primary.value}`);
    }
  }

  // Validate moods
  if (!result.moods || !Array.isArray(result.moods)) {
    errors.push('Missing or invalid moods array');
  } else {
    result.moods.forEach((mood: any, index: number) => {
      if (!mood.value) {
        errors.push(`Mood at index ${index} missing value`);
      } else if (!isValidMood(mood.value)) {
        warnings.push(`Invalid mood: ${mood.value}`);
      }
      if (typeof mood.confidence !== 'number' || mood.confidence < 0 || mood.confidence > 1) {
        warnings.push(`Mood ${mood.value} has invalid confidence: ${mood.confidence}`);
      }
    });
  }

  // Validate use cases
  if (!result.use_cases || !Array.isArray(result.use_cases)) {
    errors.push('Missing or invalid use_cases array');
  } else {
    result.use_cases.forEach((useCase: any, index: number) => {
      if (!useCase.value) {
        errors.push(`Use case at index ${index} missing value`);
      } else if (!isValidUseCase(useCase.value)) {
        warnings.push(`Invalid use case: ${useCase.value}`);
      }
      if (typeof useCase.confidence !== 'number' || useCase.confidence < 0 || useCase.confidence > 1) {
        warnings.push(`Use case ${useCase.value} has invalid confidence: ${useCase.confidence}`);
      }
    });
  }

  // Validate confidence scores
  if (result.style_primary && typeof result.style_primary.confidence !== 'number') {
    warnings.push('style_primary missing confidence score');
  }

  // Check for evidence arrays (warnings, not errors)
  if (result.style_primary && (!result.style_primary.evidence || !Array.isArray(result.style_primary.evidence))) {
    warnings.push('style_primary missing evidence array');
  }

  const isValid = errors.length === 0;
  return { isValid, errors, warnings };
}

/**
 * Sanity check rules for font characteristics
 */
export function applySanityRules(parsedData: any, analysisResult: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Rule: UI use-case requires serif=false or justification
  if (analysisResult.use_cases?.some((uc: any) => uc.value === 'ui')) {
    if (analysisResult.style_primary?.value === 'Serif' && !analysisResult.style_primary.evidence?.some((e: string) => e.includes('serifDetected=false'))) {
      warnings.push('UI use-case typically requires sans-serif fonts');
    }
  }

  // Rule: Body text requires reasonable x-height
  if (analysisResult.use_cases?.some((uc: any) => uc.value === 'body_text')) {
    const xHeightRatio = parsedData.visual_metrics?.x_height_ratio;
    if (xHeightRatio && (xHeightRatio < 0.4 || xHeightRatio > 0.7)) {
      warnings.push(`Body text use-case with unusual x-height ratio: ${xHeightRatio}`);
    }
  }

  // Rule: Display-only if legibility drops under 12px (would need rendering test)
  // This is a placeholder for future enhancement

  return { isValid: true, errors, warnings };
}

/**
 * Calculate overall confidence score
 */
export function calculateConfidence(analysisResult: any): number {
  let totalConfidence = 0;
  let count = 0;

  if (analysisResult.style_primary?.confidence !== undefined) {
    totalConfidence += analysisResult.style_primary.confidence;
    count++;
  }

  if (analysisResult.moods) {
    analysisResult.moods.forEach((mood: any) => {
      if (mood.confidence !== undefined) {
        totalConfidence += mood.confidence;
        count++;
      }
    });
  }

  if (analysisResult.use_cases) {
    analysisResult.use_cases.forEach((uc: any) => {
      if (uc.confidence !== undefined) {
        totalConfidence += uc.confidence;
        count++;
      }
    });
  }

  return count > 0 ? totalConfidence / count : 0;
}

