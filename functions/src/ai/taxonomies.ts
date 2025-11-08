import type { StylePrimary, Substyle } from '../models/contracts';
import { SUBSTYLE, MOODS, USE_CASES } from '../models/contracts';

const STYLE_SUBTYPE_MAP: Record<StylePrimary, Substyle[]> = {
	serif: ['oldstyle', 'transitional', 'didone', 'humanist_serif', 'mechanistic', 'clarendon', 'reverse_contrast', 'decorative', 'unknown'],
	sans: ['humanist', 'grotesque', 'neo_grotesque', 'geometric', 'industrial', 'techno', 'rounded', 'reverse_contrast', 'unknown'],
	slab: ['mechanistic', 'clarendon', 'rounded', 'reverse_contrast', 'unknown'],
	mono: ['unknown'],
	display: ['stencil', 'bitmap', 'decorative', 'reverse_contrast', 'industrial', 'techno', 'unknown'],
	script: ['handwriting', 'brush', 'calligraphic', 'decorative', 'unknown'],
	blackletter: ['decorative', 'reverse_contrast', 'unknown'],
	icon: ['unknown'],
};

export function getValidSubtypes(mainClass: string): Substyle[] {
	const key = mainClass.toLowerCase() as StylePrimary;
	return STYLE_SUBTYPE_MAP[key] ?? SUBSTYLE;
}

export function isValidSubtype(mainClass: string, subtype: string): boolean {
	return getValidSubtypes(mainClass).includes(subtype as Substyle);
}

export function isValidMood(mood: string): mood is typeof MOODS[number] {
	return (MOODS as readonly string[]).includes(mood);
}

export function isValidUseCase(useCase: string): useCase is typeof USE_CASES[number] {
	return (USE_CASES as readonly string[]).includes(useCase);
}
