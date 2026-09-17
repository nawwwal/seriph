export const MOODS = [
  "neutral",
  "friendly",
  "authoritative",
  "elegant",
  "playful",
  "technical",
  "classic",
  "brutal",
  "warm",
  "refined",
  "energetic",
  "minimalist",
  "retro",
  "futuristic",
  "serious",
  "expressive",
] as const;

export type Mood = (typeof MOODS)[number];

export function isTaxonomyMood(value: string): value is Mood {
  return (MOODS as readonly string[]).includes(value);
}
