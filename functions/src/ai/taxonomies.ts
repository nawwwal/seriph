import type { Mood, StylePrimary, Substyle, UseCase } from '../models/contracts';
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

export function isValidMood(mood: string): mood is Mood {
	return (MOODS as readonly string[]).includes(mood);
}

export function isValidUseCase(useCase: string): useCase is UseCase {
	return (USE_CASES as readonly string[]).includes(useCase);
}

export function normalizeTaxonomyToken(value: string): string {
	return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function parseMood(value: string): Mood | undefined {
	const token = normalizeTaxonomyToken(value);
	return isValidMood(token) ? token : undefined;
}

export function parseUseCase(value: string): UseCase | undefined {
	const token = normalizeTaxonomyToken(value);
	return isValidUseCase(token) ? token : undefined;
}

export function taxonomyMoods(values: unknown): Mood[] {
	return uniqueParsed(values, parseMood);
}

export function taxonomyUseCases(values: unknown): UseCase[] {
	return uniqueParsed(values, parseUseCase);
}

function uniqueParsed<T>(values: unknown, parse: (value: string) => T | undefined): T[] {
	if (!Array.isArray(values)) return [];
	const out: T[] = [];
	for (const value of values) {
		if (typeof value !== "string") continue;
		const parsed = parse(value);
		if (parsed !== undefined && !out.includes(parsed)) out.push(parsed);
	}
	return out;
}
