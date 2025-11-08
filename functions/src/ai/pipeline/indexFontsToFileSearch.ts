import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { GoogleAuth } from 'google-auth-library';

import { getConfigBoolean, getConfigValue } from '../../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../../config/rcKeys';
import type {
        FileSearchReference,
        FirestoreFontFamily,
        FirestoreFontStyle,
        SearchSignalsDocument,
} from '../../models/search.models';
import { withRetry } from '../utils/retry';

const FAMILIES_COLLECTION = 'families';
const STYLES_COLLECTION = 'styles';
const SIGNALS_COLLECTION = 'searchSignals';

const DEFAULT_CHUNK_TOKENS = 256;
const DEFAULT_CHUNK_OVERLAP = 32;

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
        throw new Error('Unable to obtain access token for Vertex API');
}

interface UploadProfilePayload {
        id: string;
        storeName: string;
        displayName: string;
        content: string;
        metadata: Record<string, any>;
}

interface UploadResult {
        docName: string;
        revisionId?: string;
}

interface IndexFontsOptions {
        familyId: string;
        styleIds?: string[];
        force?: boolean;
        environment?: string;
}

interface IndexedSummary {
        familyProfile?: FileSearchReference | null;
        styleProfiles: Record<string, FileSearchReference | null>;
        skipped: string[];
}

function getProjectId(): string {
        return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'seriph';
}

function getLocationId(): string {
        return getConfigValue(RC_KEYS.vertexLocationId, RC_DEFAULTS[RC_KEYS.vertexLocationId]);
}

function getChunkingConfig() {
        return {
                chunking_config: {
                        white_space_config: {
                                max_tokens_per_chunk: DEFAULT_CHUNK_TOKENS,
                                max_overlap_tokens: DEFAULT_CHUNK_OVERLAP,
                        },
                },
        };
}

function stableHash(input: string): string {
        return createHash('sha256').update(input, 'utf8').digest('hex');
}

async function fetchFamily(familyId: string): Promise<FirestoreFontFamily | null> {
        const ref = admin.firestore().collection(FAMILIES_COLLECTION).doc(familyId);
        const snap = await ref.get();
        if (!snap.exists) return null;
        const data = snap.data() as FirestoreFontFamily;
        return { ...data, familyId };
}

async function fetchStyles(familyId: string, styleIds?: string[]): Promise<FirestoreFontStyle[]> {
        const collection = admin.firestore().collection(STYLES_COLLECTION);
        let query = collection.where('familyId', '==', familyId);
        if (styleIds && styleIds.length > 0) {
                const unique = Array.from(new Set(styleIds));
                if (unique.length === 1) {
                        query = query.where('styleId', '==', unique[0]!);
                }
        }
        const snap = await query.get();
        const docs: FirestoreFontStyle[] = [];
        snap.forEach((doc) => {
                const raw = doc.data() as FirestoreFontStyle;
                docs.push({ ...raw, styleId: raw.styleId || doc.id });
        });
        if (styleIds && styleIds.length > 1) {
                const filter = new Set(styleIds);
                return docs.filter((doc) => filter.has(doc.styleId));
        }
        return docs;
}

async function fetchSignals(styleIds: string[]): Promise<Record<string, SearchSignalsDocument>> {
        if (styleIds.length === 0) return {};
        const chunks: string[][] = [];
        for (let i = 0; i < styleIds.length; i += 10) {
                chunks.push(styleIds.slice(i, i + 10));
        }
        const db = admin.firestore();
        const results: Record<string, SearchSignalsDocument> = {};
        await Promise.all(
                chunks.map(async (chunk) => {
                        const snap = await db
                                .collection(SIGNALS_COLLECTION)
                                .where('styleId', 'in', chunk)
                                .get();
                        snap.forEach((doc) => {
                                const data = doc.data() as SearchSignalsDocument;
                                if (data?.styleId) {
                                        results[data.styleId] = data;
                                }
                        });
                })
        );
        return results;
}

function buildFamilyProfile(family: FirestoreFontFamily, styles: FirestoreFontStyle[]): string {
        const parts: string[] = [];
        parts.push(`# ${family.name}`);
        if (family.classification) {
                parts.push(`Classification: ${family.classification}`);
        }
        if (family.foundry) {
                parts.push(`Foundry: ${family.foundry}`);
        }
        if (Array.isArray(family.designers) && family.designers.length > 0) {
                parts.push(`Designers: ${family.designers.join(', ')}`);
        }
        if (family.releaseYear) {
                parts.push(`Release year: ${family.releaseYear}`);
        }
        if (Array.isArray(family.tags) && family.tags.length > 0) {
                parts.push(`Tags: ${family.tags.join(', ')}`);
        }
        if (Array.isArray(family.genres) && family.genres.length > 0) {
                parts.push(`Genres: ${family.genres.join(', ')}`);
        }
        if (family.description) {
                parts.push(`\n${family.description}`);
        }
        if (styles.length > 0) {
                parts.push('\n## Styles');
                styles.slice(0, 12).forEach((style) => {
                        const descriptors: string[] = [];
                        if (style.weight) descriptors.push(`weight ${style.weight}`);
                        if (style.width) descriptors.push(`width class ${style.width}`);
                        if (style.isVariable) descriptors.push('variable');
                        if (Array.isArray(style.scripts) && style.scripts.length > 0) {
                                descriptors.push(`scripts ${style.scripts.join('/')}`);
                        }
                        parts.push(`- ${style.styleName || style.styleId}${descriptors.length ? ` (${descriptors.join(', ')})` : ''}`);
                });
        }
        return parts.join('\n');
}

function buildStyleProfile(style: FirestoreFontStyle, family: FirestoreFontFamily, signal?: SearchSignalsDocument): string {
        const lines: string[] = [];
        lines.push(`# ${family.name} – ${style.styleName}`);
        if (family.classification) {
                lines.push(`Classification: ${family.classification}`);
        }
        if (style.isVariable) {
                const axes = (style.axes || []).map((axis) => `${axis.tag} ${axis.min}-${axis.max}`).join(', ');
                if (axes) {
                        lines.push(`Variable axes: ${axes}`);
                }
        }
        if (style.weight) lines.push(`Weight: ${style.weight}`);
        if (style.width) lines.push(`Width class: ${style.width}`);
        if (typeof style.slant === 'number') lines.push(`Slant: ${style.slant}`);
        if (style.italicAngle) lines.push(`Italic angle: ${style.italicAngle}`);
        if (style.metrics) {
                const { upm, asc, desc, xHeight, capHeight, xHeightRatio, spacingClass } = style.metrics;
                const metrics: string[] = [];
                if (upm) metrics.push(`UPM ${upm}`);
                if (asc) metrics.push(`asc ${asc}`);
                if (desc) metrics.push(`desc ${desc}`);
                if (xHeight) metrics.push(`x-height ${xHeight}`);
                if (capHeight) metrics.push(`cap ${capHeight}`);
                if (xHeightRatio) metrics.push(`xHeightRatio ${xHeightRatio}`);
                if (spacingClass) metrics.push(`spacing ${spacingClass}`);
                if (metrics.length > 0) {
                        lines.push(`Metrics: ${metrics.join(', ')}`);
                }
        }
        if (Array.isArray(style.features) && style.features.length > 0) {
                lines.push(`Features: ${style.features.join(', ')}`);
        }
        if (Array.isArray(style.scripts) && style.scripts.length > 0) {
                lines.push(`Scripts: ${style.scripts.join(', ')}`);
        }
        if (Array.isArray(style.languages) && style.languages.length > 0) {
                lines.push(`Languages: ${style.languages.join(', ')}`);
        }
        if (style.coverageSummary) {
                        lines.push(`Coverage: ${style.coverageSummary}`);
        }
        if (signal?.trendingScore) {
                lines.push(`Trending score: ${signal.trendingScore}`);
        }
        if (signal?.clickThroughRate) {
                lines.push(`Click-through rate: ${Math.round(signal.clickThroughRate * 1000) / 10}%`);
        }
        return lines.join('\n');
}

function familyMetadataForProfile(family: FirestoreFontFamily): Record<string, any> {
        const { classification, license, tags, genres, languages, scripts, foundry, releaseYear, popularity } = family;
        return {
                type: 'family',
                familyId: family.familyId,
                classification: classification?.toLowerCase?.() || null,
                license: license || null,
                tags: tags || [],
                genres: genres || [],
                languages: languages || [],
                scripts: scripts || [],
                foundry: foundry || null,
                release_year: releaseYear || null,
                popularity: popularity ?? null,
        };
}

function styleMetadataForProfile(style: FirestoreFontStyle, family: FirestoreFontFamily): Record<string, any> {
        const axisTags = Array.isArray(style.axes) ? style.axes.map((axis) => axis.tag) : [];
        const weightAxes = (style.axes || []).filter((axis) => axis.tag === 'wght');
        const weightMin =
                style.isVariable && weightAxes.length > 0
                        ? Math.min(...weightAxes.map((axis) => axis.min))
                        : style.weight;
        const weightMax =
                style.isVariable && weightAxes.length > 0
                        ? Math.max(...weightAxes.map((axis) => axis.max))
                        : style.weight;
        const metadata: Record<string, any> = {
                type: 'style',
                familyId: style.familyId,
                styleId: style.styleId,
                classification: (style.classification || family.classification || '').toLowerCase?.() || null,
                license: style.license || family.license || null,
                scripts: style.scripts || family.scripts || [],
                features: style.features || [],
                is_variable: Boolean(style.isVariable),
                axis_tags: axisTags,
                weight_min: typeof weightMin === 'number' && Number.isFinite(weightMin) ? weightMin : null,
                weight_max: typeof weightMax === 'number' && Number.isFinite(weightMax) ? weightMax : null,
                width_class: style.width ?? null,
                italic: style.italicAngle ? true : false,
                opsz_min: style.opszRange?.min ?? null,
                opsz_max: style.opszRange?.max ?? null,
        };
        return metadata;
}

async function callUploadProfile(payload: UploadProfilePayload): Promise<UploadResult | null> {
        const enable = getConfigBoolean(RC_KEYS.searchEnableFileSearch, booleanDefault(RC_KEYS.searchEnableFileSearch));
        if (!enable) {
                return {
                        docName: `mock://${payload.storeName}/${payload.id}`,
                        revisionId: `rev-${Date.now()}`,
                };
        }

        const project = getProjectId();
        const location = getLocationId();
        const storePath = `projects/${project}/locations/${location}/fileSearchStores/${payload.storeName}`;
        const url = `https://${location}-aiplatform.googleapis.com/v1beta1/${storePath}/files:upload`;
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        const token = await acquireAccessToken(auth);

        const body = {
                file: {
                        displayName: payload.displayName,
                        contents: [
                                {
                                        data: Buffer.from(payload.content, 'utf8').toString('base64'),
                                        mimeType: 'text/markdown',
                                },
                        ],
                        metadata: payload.metadata,
                },
                ...getChunkingConfig(),
        };

        try {
                const response = await withRetry('uploadFileSearchProfile', async () => {
                        const res = await fetchApi(url, {
                                method: 'POST',
                                headers: {
                                        Authorization: `Bearer ${token}`,
                                        'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(body),
                        });
                        if (!res.ok) {
                                const text = await res.text();
                                throw new Error(`Vertex upload failed (${res.status}): ${text}`);
                        }
                        return res.json();
                });
                const operationName: string | undefined = response?.name;
                if (!operationName) {
                        return {
                                docName: response?.file?.name || `mock://${payload.storeName}/${payload.id}`,
                                revisionId: response?.file?.revisionId,
                        };
                }
                const final = await waitForOperation(operationName, token, location);
                if (final?.response?.file) {
                        return {
                                docName: final.response.file.name,
                                revisionId: final.response.file.revisionId,
                        };
                }
                return {
                        docName: final?.response?.name || `mock://${payload.storeName}/${payload.id}`,
                        revisionId: final?.response?.revisionId,
                };
        } catch (error) {
                console.error('[indexFontsToFileSearch] Upload failed, continuing without Vertex index', {
                        message: (error as any)?.message,
                });
                return null;
        }
}

async function waitForOperation(name: string, token: string, location: string): Promise<any> {
        const pollUrl = `https://${location}-aiplatform.googleapis.com/v1beta1/${name}`;
        for (let attempt = 0; attempt < 20; attempt++) {
                const res = await fetchApi(pollUrl, {
                        headers: {
                                Authorization: `Bearer ${token}`,
                        },
                });
                if (!res.ok) {
                        const text = await res.text();
                        throw new Error(`Failed to poll operation ${name}: ${res.status} ${text}`);
                }
                const body = await res.json();
                if (body.done) {
                        return body;
                }
                await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * Math.pow(1.5, attempt), 5000)));
        }
        throw new Error(`Operation ${name} did not complete in allotted time`);
}

function shouldReindex(existing: FileSearchReference | undefined | null, newHash: string, force?: boolean): boolean {
        if (force) return true;
        if (!existing?.contentHash) return true;
        return existing.contentHash !== newHash;
}

function buildReference(storeName: string, upload: UploadResult | null, contentHash: string): FileSearchReference | null {
        if (!upload) return null;
        return {
                storeName,
                docName: upload.docName,
                revisionId: upload.revisionId,
                contentHash,
                updatedAt: new Date().toISOString(),
        };
}

async function persistFamilyReference(familyId: string, reference: FileSearchReference | null) {
        const ref = admin.firestore().collection(FAMILIES_COLLECTION).doc(familyId);
        await ref.set(
                {
                        search: {
                                familyProfile: reference,
                        },
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
        );
}

async function persistStyleReference(styleId: string, reference: FileSearchReference | null) {
        const ref = admin.firestore().collection(STYLES_COLLECTION).doc(styleId);
        await ref.set(
                {
                        search: {
                                styleProfile: reference,
                        },
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
        );
}

export async function indexFontsToFileSearch(options: IndexFontsOptions): Promise<IndexedSummary> {
        const { familyId, styleIds, force } = options;
        if (!familyId) {
                throw new Error('familyId is required');
        }

        const family = await fetchFamily(familyId);
        if (!family) {
                throw new Error(`Family ${familyId} not found`);
        }

        const styles = await fetchStyles(familyId, styleIds);
        const signals = await fetchSignals(styles.map((style) => style.styleId));

        const familyContent = buildFamilyProfile(family, styles);
        const familyHash = stableHash(familyContent);
        const familyStore = getConfigValue(RC_KEYS.searchFileStoreFamily, RC_DEFAULTS[RC_KEYS.searchFileStoreFamily]);

        let familyReference: FileSearchReference | null | undefined = family.search?.familyProfile ?? null;
        if (shouldReindex(familyReference, familyHash, force)) {
                const upload = await callUploadProfile({
                        id: familyId,
                        storeName: familyStore,
                        displayName: `Family: ${family.name}`,
                        content: familyContent,
                        metadata: familyMetadataForProfile(family),
                });
                familyReference = buildReference(familyStore, upload, familyHash);
                if (familyReference) {
                        await persistFamilyReference(familyId, familyReference);
                }
        }

        const styleStore = getConfigValue(RC_KEYS.searchFileStoreStyle, RC_DEFAULTS[RC_KEYS.searchFileStoreStyle]);
        const styleReferences: Record<string, FileSearchReference | null> = {};
        const skipped: string[] = [];

        for (const style of styles) {
                const styleContent = buildStyleProfile(style, family, signals[style.styleId]);
                const styleHash = stableHash(styleContent);
                const existing = style.search?.styleProfile;
                if (!shouldReindex(existing, styleHash, force)) {
                        styleReferences[style.styleId] = existing || null;
                        skipped.push(style.styleId);
                        continue;
                }
                const upload = await callUploadProfile({
                        id: style.styleId,
                        storeName: styleStore,
                        displayName: `Style: ${family.name} ${style.styleName}`,
                        content: styleContent,
                        metadata: styleMetadataForProfile(style, family),
                });
                const reference = buildReference(styleStore, upload, styleHash);
                styleReferences[style.styleId] = reference;
                if (reference) {
                        await persistStyleReference(style.styleId, reference);
                }
        }

        return {
                familyProfile: familyReference || null,
                styleProfiles: styleReferences,
                skipped,
        };
}

export async function deleteStyleFromFileSearch(styleId: string): Promise<void> {
        if (!styleId) return;
        const styleDoc = await admin.firestore().collection(STYLES_COLLECTION).doc(styleId).get();
        if (!styleDoc.exists) return;
        const style = styleDoc.data() as FirestoreFontStyle;
        const reference = style?.search?.styleProfile;
        if (!reference?.docName) return;
        try {
                await deleteFileSearchDocument(reference.docName);
        } catch (error) {
                console.error('Failed to delete style from File Search store', { styleId, message: (error as any)?.message });
        }
        await styleDoc.ref.set(
                {
                        search: {
                                styleProfile: admin.firestore.FieldValue.delete(),
                        },
                },
                { merge: true }
        );
}

async function deleteFileSearchDocument(resourceName: string): Promise<void> {
        const enable = getConfigBoolean(RC_KEYS.searchEnableFileSearch, booleanDefault(RC_KEYS.searchEnableFileSearch));
        if (!enable) return;
        const location = getLocationId();
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        const token = await acquireAccessToken(auth);
        const url = `https://${location}-aiplatform.googleapis.com/v1beta1/${resourceName}`;
        const res = await fetchApi(url, {
                method: 'DELETE',
                headers: {
                        Authorization: `Bearer ${token}`,
                },
        });
        if (!res.ok) {
                const text = await res.text();
                throw new Error(`Failed to delete File Search doc ${resourceName}: ${res.status} ${text}`);
        }
}

