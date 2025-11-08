import * as admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';

import { initializeRemoteConfig, getConfigBoolean, getConfigNumber, getConfigValue } from '../../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../../config/rcKeys';
import type {
        FirestoreFontFamily,
        FirestoreFontStyle,
        SearchRequestPayload,
        SearchResponsePayload,
        SearchFilters,
        SemanticSearchHit,
        SearchSignalsDocument,
        SearchResultItem,
        SearchFacetCounts,
} from '../../models/search.models';
import { withRetry } from '../utils/retry';
import { generateStrictJSON } from '../vertex/vertexClient';
import { getValidSubtypes, isValidMood } from '../taxonomies';

const FAMILIES_COLLECTION = 'families';
const STYLES_COLLECTION = 'styles';
const SIGNALS_COLLECTION = 'searchSignals';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

type FetchFn = (input: any, init?: any) => Promise<any>;
const fetchApi: FetchFn = ((globalThis as any).fetch?.bind(globalThis)) ?? (async () => {
        throw new Error('Fetch API not available in this environment');
});

function booleanDefault(key: keyof typeof RC_DEFAULTS): boolean {
        return String(RC_DEFAULTS[key]).toLowerCase() === 'true';
}

async function acquireAccessToken(auth: GoogleAuth): Promise<string> {
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        if (typeof token === 'string') return token;
        if (token && typeof (token as any).token === 'string') {
                return (token as any).token as string;
        }
        throw new Error('Unable to obtain access token for File Search');
}

interface SemanticResponse {
        hits: SemanticSearchHit[];
        raw?: any;
}

export async function searchFonts(request: SearchRequestPayload): Promise<SearchResponsePayload> {
        await initializeRemoteConfig().catch(() => undefined);
        const normalized = normalizeSearchRequest(request);
        const styles = await fetchCandidateStyles(normalized.filters, normalized.maxCandidates);
        const filtered = applyPostFilters(styles, normalized.filters);
        const totalCandidates = filtered.length;
        const families = await fetchFamiliesForStyles(filtered.map((style) => style.familyId));
        const signals = await fetchSignals(filtered.map((style) => style.styleId));

        const semantic = normalized.query
                ? await runSemanticSearch(normalized.query, normalized.filters, filtered, normalized.semanticTopK)
                : { hits: [] };

        const blended = blendResults({
                styles: filtered,
                families,
                signals,
                semanticHits: semantic.hits,
                request: normalized,
        });

        const reranked = await maybeRerank(blended, normalized);
        const paged = paginateResults(reranked, normalized.page, normalized.pageSize);
        const facets = computeFacets(filtered, families);

        return {
                results: paged.results,
                facets,
                pagination: {
                        page: normalized.page,
                        pageSize: normalized.pageSize,
                        totalCandidates,
                },
                debug: normalized.debug
                        ? {
                                  semanticHits: semantic.hits,
                                  totalStyles: styles.length,
                                  filteredStyles: filtered.length,
                                  reranked: reranked.length,
                          }
                        : undefined,
        };
}

interface NormalizedRequest {
        query: string | null;
        filters: SearchFilters;
        page: number;
        pageSize: number;
        maxCandidates: number;
        semanticTopK: number;
        weights: {
                semantic: number;
                exact: number;
                popularity: number;
                mood: number;
        };
        rerankEnabled: boolean;
        debug: boolean;
}

function normalizeSearchRequest(request: SearchRequestPayload): NormalizedRequest {
        const page = Math.max(1, request.page ?? 1);
        const requestedSize = request.pageSize ?? DEFAULT_PAGE_SIZE;
        const pageSize = Math.min(Math.max(1, requestedSize), MAX_PAGE_SIZE);
        const maxCandidates = getConfigNumber(
                RC_KEYS.searchMaxCandidates,
                Number(RC_DEFAULTS[RC_KEYS.searchMaxCandidates])
        );
        const semanticTopK = getConfigNumber(
                RC_KEYS.searchFileSearchTopK,
                Number(RC_DEFAULTS[RC_KEYS.searchFileSearchTopK])
        );
        const filters = normalizeFilters(request.filters || {});
        const weights = {
                semantic: getConfigNumber(
                        RC_KEYS.searchSemanticWeight,
                        Number(RC_DEFAULTS[RC_KEYS.searchSemanticWeight])
                ),
                exact: getConfigNumber(
                        RC_KEYS.searchExactWeight,
                        Number(RC_DEFAULTS[RC_KEYS.searchExactWeight])
                ),
                popularity: getConfigNumber(
                        RC_KEYS.searchPopularityWeight,
                        Number(RC_DEFAULTS[RC_KEYS.searchPopularityWeight])
                ),
                mood: getConfigNumber(
                        RC_KEYS.searchMoodWeight,
                        Number(RC_DEFAULTS[RC_KEYS.searchMoodWeight])
                ),
        };
        const query = expandQuery(request.q || '');
        const rerankEnabled = getConfigBoolean(RC_KEYS.searchEnableRerank, booleanDefault(RC_KEYS.searchEnableRerank));
        const debug = Boolean(request.debug);
        return {
                query: query.length > 0 ? query : null,
                filters,
                page,
                pageSize,
                maxCandidates,
                semanticTopK,
                weights,
                rerankEnabled,
                debug,
        };
}

function normalizeFilters(filters: SearchFilters): SearchFilters {
        const normalized: SearchFilters = { ...filters };
        if (normalized.classification) {
                normalized.classification = normalized.classification.map((value) => value.toLowerCase());
        }
        if (normalized.license) {
                normalized.license = normalized.license.map((value) => value.toLowerCase());
        }
        if (normalized.axis) {
                normalized.axis = normalized.axis.map((axis) => axis.toLowerCase());
        }
        if (normalized.features) {
                normalized.features = normalized.features.map((feature) => feature.toLowerCase());
        }
        if (normalized.scripts) {
                normalized.scripts = normalized.scripts.map((script) => script.trim());
        }
        return normalized;
}

function expandQuery(input: string): string {
        const trimmed = input.trim();
        if (!trimmed) return '';
        const tokens = trimmed.split(/\s+/);
        const synonyms: string[] = [];
        tokens.forEach((token) => {
                const lower = token.toLowerCase();
                if (lower === 'condensed') synonyms.push('narrow');
                if (lower === 'expanded') synonyms.push('wide');
                if (lower === 'rounded') synonyms.push('soft');
                if (lower === 'humanist') synonyms.push('humanist sans', 'humanist serif');
                const subtypes = getValidSubtypes('sans');
                if (subtypes.includes(lower as any)) {
                        synonyms.push(`${lower} sans`, `${lower} serif`);
                }
                if (isValidMood(lower)) {
                        synonyms.push(`${lower} mood`);
                }
        });
        const expanded = Array.from(new Set([...tokens, ...synonyms])).join(' ');
        return expanded.trim();
}

async function fetchCandidateStyles(filters: SearchFilters, maxCandidates: number): Promise<FirestoreFontStyle[]> {
        let query: FirebaseFirestore.Query = admin.firestore().collection(STYLES_COLLECTION);
        if (filters.familyIds && filters.familyIds.length > 0) {
                if (filters.familyIds.length === 1) {
                        query = query.where('familyId', '==', filters.familyIds[0]);
                }
        }
        if (filters.styleIds && filters.styleIds.length === 1) {
                query = query.where('styleId', '==', filters.styleIds[0]);
        }
        if (filters.classification && filters.classification.length > 0) {
                const values = filters.classification.slice(0, 10);
                if (values.length === 1) {
                        query = query.where('classification', '==', values[0]);
                } else {
                        query = query.where('classification', 'in', values);
                }
        }
        if (filters.license && filters.license.length > 0) {
                const values = filters.license.slice(0, 10);
                if (values.length === 1) {
                        query = query.where('license', '==', values[0]);
                } else {
                        query = query.where('license', 'in', values);
                }
        }
        if (filters.isVariable !== undefined) {
                query = query.where('isVariable', '==', filters.isVariable);
        }
        if (filters.axis && filters.axis.length > 0) {
                query = query.where('axisTags', 'array-contains-any', filters.axis.slice(0, 10));
        }
        if (filters.features && filters.features.length > 0) {
                query = query.where('features', 'array-contains-any', filters.features.slice(0, 10));
        }
        if (filters.scripts && filters.scripts.length === 1) {
                query = query.where('scripts', 'array-contains', filters.scripts[0]);
        }
        if (filters.weight?.point) {
                query = query.where('weight', '>=', filters.weight.point - 100).where('weight', '<=', filters.weight.point + 100);
        }
        if (filters.widthClass?.min !== undefined) {
                query = query.where('width', '>=', filters.widthClass.min);
        }
        if (filters.widthClass?.max !== undefined) {
                query = query.where('width', '<=', filters.widthClass.max);
        }
        const snapshot = await query.limit(maxCandidates).get();
        const styles: FirestoreFontStyle[] = [];
        snapshot.forEach((doc) => {
                const data = doc.data() as FirestoreFontStyle;
                styles.push({ ...data, styleId: data.styleId || doc.id });
        });
        return styles;
}

function applyPostFilters(styles: FirestoreFontStyle[], filters: SearchFilters): FirestoreFontStyle[] {
        return styles.filter((style) => {
                if (filters.scripts && filters.scripts.length > 1) {
                        const styleScripts = style.scripts || [];
                        const missing = filters.scripts.some((script) => !styleScripts.includes(script));
                        if (missing) return false;
                }
                if (filters.weight?.min !== undefined) {
                        if ((style.weight ?? 0) < filters.weight.min) return false;
                }
                if (filters.weight?.max !== undefined) {
                        if ((style.weight ?? 0) > filters.weight.max) return false;
                }
                if (filters.opsz?.min !== undefined && style.opszRange?.min !== undefined) {
                        if (style.opszRange.min > filters.opsz.min) return false;
                }
                if (filters.opsz?.max !== undefined && style.opszRange?.max !== undefined) {
                        if (style.opszRange.max < filters.opsz.max) return false;
                }
                if (filters.axis && filters.axis.length > 0) {
                        const axisTags = style.axisTags || (style.axes || []).map((axis) => axis.tag);
                        const missingAxis = filters.axis.some((axis) => !axisTags.includes(axis));
                        if (missingAxis) return false;
                }
                return true;
        });
}

async function fetchFamiliesForStyles(familyIds: string[]): Promise<Record<string, FirestoreFontFamily>> {
        const unique = Array.from(new Set(familyIds)).filter(Boolean);
        const db = admin.firestore();
        const results: Record<string, FirestoreFontFamily> = {};
        await Promise.all(
                unique.map(async (id) => {
                        const direct = await db.collection(FAMILIES_COLLECTION).doc(id).get();
                        if (direct.exists) {
                                const data = direct.data() as FirestoreFontFamily;
                                results[id] = { ...data, familyId: id };
                                return;
                        }
                        const snapshot = await db
                                .collection(FAMILIES_COLLECTION)
                                .where('familyId', '==', id)
                                .limit(1)
                                .get();
                        if (!snapshot.empty) {
                                const doc = snapshot.docs[0];
                                const data = doc.data() as FirestoreFontFamily;
                                const resolvedId = data.familyId || doc.id || id;
                                results[resolvedId] = { ...data, familyId: resolvedId };
                        }
                })
        );
        return results;
}

async function fetchSignals(styleIds: string[]): Promise<Record<string, SearchSignalsDocument>> {
        if (styleIds.length === 0) return {};
        const db = admin.firestore();
        const results: Record<string, SearchSignalsDocument> = {};
        await Promise.all(
                Array.from(new Set(styleIds)).map(async (id) => {
                        const direct = await db.collection(SIGNALS_COLLECTION).doc(id).get();
                        if (direct.exists) {
                                const data = direct.data() as SearchSignalsDocument;
                                results[id] = { ...data, styleId: id };
                                return;
                        }
                        const snapshot = await db
                                .collection(SIGNALS_COLLECTION)
                                .where('styleId', '==', id)
                                .limit(1)
                                .get();
                        if (!snapshot.empty) {
                                const doc = snapshot.docs[0];
                                const data = doc.data() as SearchSignalsDocument;
                                const resolvedId = data.styleId || doc.id || id;
                                results[resolvedId] = { ...data, styleId: resolvedId };
                        }
                })
        );
        return results;
}

async function runSemanticSearch(
        query: string,
        filters: SearchFilters,
        styles: FirestoreFontStyle[],
        topK: number
): Promise<SemanticResponse> {
        const enableSemantic = getConfigBoolean(
                RC_KEYS.searchEnableFileSearch,
                booleanDefault(RC_KEYS.searchEnableFileSearch)
        );
        if (!enableSemantic) {
                return { hits: [] };
        }
        if (styles.length === 0) {
                return { hits: [] };
        }
        const location = getConfigValue(RC_KEYS.vertexLocationId, RC_DEFAULTS[RC_KEYS.vertexLocationId]);
        const project = process.env.GOOGLE_CLOUD_PROJECT || 'seriph';
        const store = getConfigValue(RC_KEYS.searchFileStoreStyle, RC_DEFAULTS[RC_KEYS.searchFileStoreStyle]);
        const storePath = `projects/${project}/locations/${location}/fileSearchStores/${store}`;
        const filterExpression = buildMetadataFilter(filters, styles);
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        const token = await acquireAccessToken(auth);
        const url = `https://${location}-aiplatform.googleapis.com/v1beta1/${storePath}:search`; // Hypothetical endpoint
        const payload = {
                query: { text: query },
                metadataFilter: filterExpression || undefined,
                pageSize: topK,
        };

        try {
                const body = await withRetry('fileSearchQuery', async () => {
                        const res = await fetchApi(url, {
                                method: 'POST',
                                headers: {
                                        Authorization: `Bearer ${token}`,
                                        'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(payload),
                        });
                        if (!res.ok) {
                                const text = await res.text();
                                throw new Error(`File search query failed ${res.status}: ${text}`);
                        }
                        return res.json();
                });
                const hits: SemanticSearchHit[] = Array.isArray(body.matches)
                        ? body.matches
                                  .map((match: any) => {
                                          const docId = match?.file?.metadata?.styleId || match?.file?.metadata?.ids?.styleId;
                                          if (!docId) return null;
                                          return {
                                                  id: docId,
                                                  score: Number(match?.score ?? 0),
                                                  metadata: match?.file?.metadata || match?.metadata,
                                                  citations: Array.isArray(match?.chunks)
                                                          ? match.chunks.map((chunk: any) => ({
                                                                        doc: match.file?.name || 'unknown',
                                                                        chunkRange: chunk?.chunkRange,
                                                                        store,
                                                                }))
                                                          : undefined,
                                          } as SemanticSearchHit;
                                  })
                                  .filter(Boolean)
                        : [];
                return { hits, raw: body };
        } catch (error) {
                console.error('File search query failed, returning empty results', {
                        message: (error as any)?.message,
                });
                return { hits: [] };
        }
}

function buildMetadataFilter(filters: SearchFilters, styles: FirestoreFontStyle[]): string {
        const clauses: string[] = [];
        if (filters.classification && filters.classification.length > 0) {
                        clauses.push(`classification IN [${filters.classification.map((c) => `"${c}"`).join(', ')}]`);
        }
        if (filters.license && filters.license.length > 0) {
                        clauses.push(`license IN [${filters.license.map((c) => `"${c}"`).join(', ')}]`);
        }
        if (filters.isVariable !== undefined) {
                clauses.push(`is_variable = ${filters.isVariable ? 'true' : 'false'}`);
        }
        if (filters.axis && filters.axis.length > 0) {
                filters.axis.forEach((axis) => clauses.push(`"${axis}" IN axis_tags`));
        }
        if (filters.scripts && filters.scripts.length > 0) {
                filters.scripts.forEach((script) => clauses.push(`"${script}" IN scripts`));
        }
        if (filters.features && filters.features.length > 0) {
                filters.features.forEach((feature) => clauses.push(`"${feature}" IN features`));
        }
        if (styles.length > 0) {
                const ids = styles.slice(0, 400).map((style) => `"${style.styleId}"`);
                clauses.push(`styleId IN [${ids.join(', ')}]`);
        }
        return clauses.join(' AND ');
}

interface BlendContext {
        styles: FirestoreFontStyle[];
        families: Record<string, FirestoreFontFamily>;
        signals: Record<string, SearchSignalsDocument>;
        semanticHits: SemanticSearchHit[];
        request: NormalizedRequest;
}

function blendResults(context: BlendContext): SearchResultItem[] {
        const { styles, families, signals, semanticHits, request } = context;
        const semanticMap = new Map<string, SemanticSearchHit>();
        semanticHits.forEach((hit) => {
                semanticMap.set(hit.id, hit);
        });
        const results: SearchResultItem[] = styles.map((style) => {
                const family = families[style.familyId];
                const semanticScore = semanticMap.get(style.styleId)?.score ?? 0;
                const exactScore = computeExactScore(style, request.filters);
                const popularityScore = computePopularityScore(signals[style.styleId]);
                const moodScore = computeMoodScore(style, request.query || '');
                const score =
                        request.weights.semantic * semanticScore +
                        request.weights.exact * exactScore +
                        request.weights.popularity * popularityScore +
                        request.weights.mood * moodScore;
                const hit = semanticMap.get(style.styleId);
                return {
                        familyId: style.familyId,
                        styleId: style.styleId,
                        name: family?.name || style.styleName,
                        styleName: style.styleName,
                        description: family?.description,
                        score,
                        semanticScore,
                        exactScore,
                        popularityScore,
                        moodScore,
                        highlights: deriveHighlights(style, family, request.filters),
                        citations: hit?.citations,
                        license: style.license || family?.license,
                        scripts: style.scripts || family?.scripts,
                        features: style.features,
                        isVariable: style.isVariable,
                        axes: style.axes,
                        files: style.files,
                };
        });
        results.sort((a, b) => b.score - a.score);
        return results;
}

function computeExactScore(style: FirestoreFontStyle, filters: SearchFilters): number {
        let score = 0;
        if (!filters || Object.keys(filters).length === 0) {
                return 0.5;
        }
        if (filters.classification && filters.classification.includes((style.classification || '').toLowerCase())) {
                score += 0.3;
        }
        if (filters.license && filters.license.includes((style.license || '').toLowerCase())) {
                score += 0.2;
        }
        if (filters.isVariable !== undefined && filters.isVariable === Boolean(style.isVariable)) {
                score += 0.2;
        }
        if (filters.scripts && filters.scripts.every((script) => (style.scripts || []).includes(script))) {
                score += 0.2;
        }
        if (filters.features && filters.features.some((feature) => (style.features || []).includes(feature))) {
                score += 0.1;
        }
        return Math.min(score, 1);
}

function computePopularityScore(signal?: SearchSignalsDocument): number {
        if (!signal) return 0;
        const trending = normalize(signal.trendingScore, 0, 100);
        const ctr = normalize(signal.clickThroughRate, 0, 1);
        const saves = normalize(signal.saves, 0, 1000);
        return (trending * 0.5 + ctr * 0.3 + saves * 0.2);
}

function computeMoodScore(style: FirestoreFontStyle, query: string): number {
        if (!query) return 0;
        const lower = query.toLowerCase();
        if (lower.includes('rounded') && (style.features || []).includes('ss01')) {
                return 0.6;
        }
        if (lower.includes('branding') && (style.features || []).includes('liga')) {
                return 0.4;
        }
        return 0.1;
}

function normalize(value: number | undefined, min: number, max: number): number {
        if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
        if (max === min) return 0;
        const clamped = Math.max(min, Math.min(max, value));
        return (clamped - min) / (max - min);
}

function deriveHighlights(
        style: FirestoreFontStyle,
        family: FirestoreFontFamily | undefined,
        filters: SearchFilters
): string[] {
        const highlights: string[] = [];
        if (filters.scripts && filters.scripts.length > 0) {
                filters.scripts.forEach((script) => {
                        if ((style.scripts || family?.scripts || []).includes(script)) {
                                highlights.push(`supports ${script}`);
                        }
                });
        }
        if (filters.features && filters.features.length > 0) {
                filters.features.forEach((feature) => {
                        if ((style.features || []).includes(feature)) {
                                highlights.push(`has ${feature} feature`);
                        }
                });
        }
        if (style.isVariable) {
                highlights.push('variable font');
        }
        if (style.axes && style.axes.length > 0) {
                highlights.push(`axes ${style.axes.map((axis) => axis.tag).join(', ')}`);
        }
        return highlights.slice(0, 6);
}

async function maybeRerank(results: SearchResultItem[], request: NormalizedRequest): Promise<SearchResultItem[]> {
        if (!request.rerankEnabled || results.length === 0 || !request.query) {
                return results;
        }
        try {
                const { data } = await generateStrictJSON<{
                        ranking: Array<{ styleId: string; boost?: number }>;
                }>({
                        modelKey: RC_KEYS.searchRerankModelName,
                        promptParts: [
                                'You are a search reranker for font results. Return JSON with "ranking" array of styleId and optional boost between -1 and 1.',
                                `Query: ${request.query}`,
                                `Candidates: ${results
                                        .slice(0, 40)
                                        .map((result) => `${result.styleId}::${result.name}::${result.highlights?.join('|')}`)
                                        .join('\n')}`,
                        ],
                        opName: 'searchRerank',
                });
                if (!data?.ranking) {
                        return results;
                }
                const boostMap = new Map<string, number>();
                data.ranking.forEach((entry) => {
                        if (entry?.styleId) {
                                boostMap.set(entry.styleId, entry.boost ?? 0);
                        }
                });
                return results
                        .map((result) => {
                                const boost = boostMap.get(result.styleId) ?? 0;
                                return { ...result, score: result.score + boost };
                        })
                        .sort((a, b) => b.score - a.score);
        } catch (error) {
                        console.warn('Rerank failed', { message: (error as any)?.message });
                        return results;
        }
}

function paginateResults(results: SearchResultItem[], page: number, pageSize: number): {
        results: SearchResultItem[];
} {
        const start = (page - 1) * pageSize;
        const slice = results.slice(start, start + pageSize);
        return { results: slice };
}

function computeFacets(styles: FirestoreFontStyle[], families: Record<string, FirestoreFontFamily>): SearchFacetCounts {
        const facets: SearchFacetCounts = {};
        const ensureFacet = (facet: string) => {
                if (!facets[facet]) facets[facet] = {};
        };
        styles.forEach((style) => {
                ensureFacet('classification');
                const classification = (style.classification || families[style.familyId]?.classification || 'unknown').toLowerCase();
                facets.classification[classification] = (facets.classification[classification] || 0) + 1;

                ensureFacet('license');
                const license = (style.license || families[style.familyId]?.license || 'unknown').toLowerCase();
                facets.license[license] = (facets.license[license] || 0) + 1;

                ensureFacet('scripts');
                (style.scripts || families[style.familyId]?.scripts || []).forEach((script) => {
                        facets.scripts[script] = (facets.scripts[script] || 0) + 1;
                });

                if (style.isVariable) {
                        ensureFacet('isVariable');
                        facets.isVariable['true'] = (facets.isVariable['true'] || 0) + 1;
                }
        });
        return facets;
}

