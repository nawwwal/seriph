// Centralized Remote Config keys and default values
export const RC_KEYS = {
	isVertexEnabled: "is_vertex_enabled",
	webEnrichmentEnabled: "web_enrichment_enabled",
	aiCacheEnabled: "ai_cache_enabled",
	aiCountTokensEnabled: "ai_count_tokens_enabled",
	vertexLocationId: "vertex_location_id",
	// Thresholds and derivations
	confidenceBandThresholds: "ai_confidence_band_thresholds", // CSV "0.2,0.6,0.85"
	opticalRangePtThresholds: "optical_range_pt_thresholds", // CSV "9,18,36"
	// Per-stage model names
	classifierModelName: "classifier_model_name",
	summaryModelName: "summary_model_name",
	visualAnalysisModelName: "visual_analysis_model_name",
	enrichedAnalysisModelName: "enriched_analysis_model_name",
	enrichedAnalysisFallbackModelName: "enriched_analysis_fallback_model_name",
	webEnricherModelName: "web_enricher_model_name",
	// Generation config
	maxOutputTokens: "ai_max_output_tokens",
	temperature: "ai_temperature",
	topP: "ai_top_p",
	topK: "ai_top_k",
	// Concurrency / retries
	maxConcurrentOps: "ai_max_concurrent_ops",
	retryMaxAttempts: "ai_retry_max_attempts",
	retryBaseMs: "ai_retry_base_ms",
	retryMaxMs: "ai_retry_max_ms",
	// Storage paths
	unprocessedBucketPath: "unprocessed_bucket_path",
	processedBucketPath: "processed_bucket_path",
	failedBucketPath: "failed_bucket_path",
	// Caching
	webEnrichmentCacheTtlDays: "web_enrichment_cache_ttl_days",
} as const;

export const RC_DEFAULTS = {
	[RC_KEYS.isVertexEnabled]: "false",
	[RC_KEYS.webEnrichmentEnabled]: "false",
	[RC_KEYS.aiCacheEnabled]: "true",
	[RC_KEYS.aiCountTokensEnabled]: "false",
	[RC_KEYS.vertexLocationId]: "asia-southeast1",
	[RC_KEYS.confidenceBandThresholds]: "0.2,0.6,0.85",
	[RC_KEYS.opticalRangePtThresholds]: "9,18,36",
	[RC_KEYS.classifierModelName]: "gemini-2.5-flash",
	[RC_KEYS.summaryModelName]: "gemini-2.5-flash",
	[RC_KEYS.visualAnalysisModelName]: "gemini-2.5-flash",
	[RC_KEYS.enrichedAnalysisModelName]: "gemini-2.5-flash",
	[RC_KEYS.enrichedAnalysisFallbackModelName]: "gemini-2.5-flash",
	[RC_KEYS.webEnricherModelName]: "gemini-2.5-flash",
	[RC_KEYS.maxOutputTokens]: "1536",
	[RC_KEYS.temperature]: "0.4",
	[RC_KEYS.topP]: "0.9",
	[RC_KEYS.topK]: "40",
	[RC_KEYS.maxConcurrentOps]: "4",
	[RC_KEYS.retryMaxAttempts]: "3",
	[RC_KEYS.retryBaseMs]: "250",
	[RC_KEYS.retryMaxMs]: "4000",
	[RC_KEYS.unprocessedBucketPath]: "unprocessed_fonts",
	[RC_KEYS.processedBucketPath]: "processed_fonts",
	[RC_KEYS.failedBucketPath]: "failed_processing",
	[RC_KEYS.webEnrichmentCacheTtlDays]: "30",
} as const;


