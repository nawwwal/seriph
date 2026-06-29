export function face(id: string, contentHash: string, storagePrefix = id) {
  return {
    id,
    styleName: id === 'regular' ? 'Regular' : 'Bold',
    weight: id === 'regular' ? 400 : 700,
    weightName: id === 'regular' ? 'Regular' : 'Bold',
    italic: false,
    isVariable: false,
    filename: `${id}.woff2`,
    woff2: { storagePath: `s/${storagePrefix}/${id}.woff2`, url: `https://seriph.web.app/s/${storagePrefix}/${id}.woff2` },
    original: { storagePath: `d/${storagePrefix}/${id}.otf`, url: `https://seriph.web.app/d/${storagePrefix}/${id}.otf` },
    contentHash,
  };
}

export function family(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: id,
    name: id.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join(' '),
    fileBase: id.replace(/-/g, ''),
    category: 'SANS_SERIF',
    ownerId: 'user-1',
    status: 'enriched',
    faces: [face('regular', `hash-${id}`, id)],
    enrichment: { summary: 'Old summary', moods: ['old'], useCases: ['old'] },
    searchText: 'old search',
    searchTokens: ['old'],
    searchMeta: { embeddingModel: 'old', embeddingVersion: 'old', promptVersion: 'old' },
    text_vec: { old: true },
    mood_vec: { old: true },
    use_case_vec: { old: true },
    ...overrides,
  };
}
