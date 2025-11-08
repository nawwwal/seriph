/**
 * Controlled vocabularies for font classification and analysis
 * These ensure consistent, constrained outputs from AI models
 */

export const STYLE_TAXONOMY = {
  SERIF: ['oldstyle', 'transitional', 'didone', 'slab'],
  SANS_SERIF: ['grotesque', 'neo_grotesque', 'humanist', 'geometric'],
  MONO: ['monospace'],
  SCRIPT: ['script', 'handwriting'],
  DISPLAY: ['blackletter', 'display', 'decorative'],
  ICON: ['icon', 'emoji'],
} as const;

export type StyleSubtype = 
  | 'oldstyle' | 'transitional' | 'didone' | 'slab'
  | 'grotesque' | 'neo_grotesque' | 'humanist' | 'geometric'
  | 'monospace'
  | 'script' | 'handwriting'
  | 'blackletter' | 'display' | 'decorative'
  | 'icon' | 'emoji';

export const USE_CASES = [
  'body_text',
  'ui',
  'wayfinding',
  'poster',
  'editorial',
  'fintech_dashboard',
  'luxury',
  'kids',
  'code',
] as const;

export type UseCase = typeof USE_CASES[number];

export const MOODS = [
  'friendly',
  'authoritative',
  'technical',
  'warm',
  'elegant',
  'brutal',
  'playful',
  'retro',
  'futuristic',
  'neutral',
] as const;

export type Mood = typeof MOODS[number];

export const CRAFT_DETAILS = [
  'high_contrast',
  'low_contrast',
  'open_apertures',
  'narrow',
  'wide',
  'high_x_height',
  'ink_traps',
  'reverse_contrast',
  'flared',
  'rounded_corners',
] as const;

export type CraftDetail = typeof CRAFT_DETAILS[number];

/**
 * Get all valid style subtypes for a given main classification
 */
export function getValidSubtypes(mainClass: string): StyleSubtype[] {
  switch (mainClass.toLowerCase()) {
    case 'serif':
      return ['oldstyle', 'transitional', 'didone', 'slab'];
    case 'sans serif':
      return ['grotesque', 'neo_grotesque', 'humanist', 'geometric'];
    case 'monospace':
      return ['monospace'];
    case 'script & handwriting':
      return ['script', 'handwriting'];
    case 'display & decorative':
      return ['blackletter', 'display', 'decorative'];
    case 'symbol & icon':
      return ['icon', 'emoji'];
    default:
      return [];
  }
}

/**
 * Validate a style subtype against main classification
 */
export function isValidSubtype(mainClass: string, subtype: string): boolean {
  const validSubtypes = getValidSubtypes(mainClass);
  return validSubtypes.includes(subtype as StyleSubtype);
}

/**
 * Validate a mood value
 */
export function isValidMood(mood: string): mood is Mood {
  return MOODS.includes(mood as Mood);
}

/**
 * Validate a use case value
 */
export function isValidUseCase(useCase: string): useCase is UseCase {
  return USE_CASES.includes(useCase as UseCase);
}

