export interface FirestoreFontFamily {
        familyId: string;
        name: string;
        designers?: string[];
        foundry?: string;
        license?: string;
        releaseYear?: number;
        tags?: string[];
        genres?: string[];
        languages?: string[];
        scripts?: string[];
        popularity?: number;
        downloads?: number;
        updatedAt?: string | Date;
        classification?: string;
        description?: string;
        search?: {
                familyProfile?: FileSearchReference;
        };
}

export interface FontAxisRange {
        tag: string;
        min: number;
        max: number;
}

export interface FirestoreFontStyle {
        styleId: string;
        familyId: string;
        styleName: string;
        weight?: number;
        width?: number;
        slant?: number;
        italicAngle?: number;
        isVariable?: boolean;
        axes?: FontAxisRange[];
        axisTags?: string[];
        opszRange?: { min: number; max: number } | null;
        features?: string[];
        unicodeRanges?: string[];
        scripts?: string[];
        languages?: string[];
        glyphCount?: number;
        kerningPairs?: number;
        metrics?: {
                upm?: number;
                asc?: number;
                desc?: number;
                xHeight?: number;
                capHeight?: number;
                xHeightRatio?: number;
                spacingClass?: string;
        } | null;
        price?: number;
        license?: string;
        files?: Array<{ format: string; url: string }>;
        coverageSummary?: string;
        classification?: string;
        updatedAt?: string | Date;
        search?: {
                styleProfile?: FileSearchReference;
        };
}

export interface SearchSignalsDocument {
        styleId: string;
        trendingScore?: number;
        clickThroughRate?: number;
        saves?: number;
        conversions?: number;
        updatedAt?: Date | string;
}

export interface SearchFilters {
        classification?: string[];
        license?: string[];
        scripts?: string[];
        isVariable?: boolean;
        axis?: string[];
        weight?: { min?: number; max?: number; point?: number };
        widthClass?: { min?: number; max?: number };
        features?: string[];
        opsz?: { min?: number; max?: number };
        familyIds?: string[];
        styleIds?: string[];
}

export type SearchSortBy = 'relevance' | 'popularity' | 'newest';

export interface SearchRequestPayload {
        q?: string;
        filters?: SearchFilters;
        sort?: { by: SearchSortBy };
        page?: number;
        pageSize?: number;
        debug?: boolean;
}

export interface SearchCitation {
        doc: string;
        chunkRange?: [number, number];
        store?: string;
}

export interface SearchResultItem {
        familyId: string;
        styleId: string;
        name: string;
        styleName?: string;
        description?: string;
        score: number;
        semanticScore?: number;
        exactScore?: number;
        popularityScore?: number;
        moodScore?: number;
        highlights?: string[];
        citations?: SearchCitation[];
        license?: string;
        scripts?: string[];
        features?: string[];
        isVariable?: boolean;
        axes?: FontAxisRange[];
        files?: Array<{ format: string; url: string }>;
}

export type SearchFacetCounts = Record<string, Record<string, number>>;

export interface SearchResponsePayload {
        results: SearchResultItem[];
        facets: SearchFacetCounts;
        pagination: {
                page: number;
                pageSize: number;
                totalCandidates: number;
        };
        debug?: Record<string, any>;
}

export interface FileSearchReference {
        storeName: string;
        docName: string;
        revisionId?: string;
        contentHash: string;
        updatedAt?: string | Date;
}

export interface SemanticSearchHit {
        id: string;
        score: number;
        metadata?: Record<string, any>;
        citations?: SearchCitation[];
}

