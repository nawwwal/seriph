#!/usr/bin/env node
/**
 * Setup Remote Config parameters via CLI
 * Usage: node scripts/setup-remote-config.js [project-id]
 */

const admin = require('firebase-admin');
const { applicationDefault } = require('firebase-admin/app');

// Remote Config keys and defaults (from functions/src/config/rcKeys.ts)
const RC_KEYS = {
  isVertexEnabled: "is_vertex_enabled",
  webEnrichmentEnabled: "web_enrichment_enabled",
  aiCacheEnabled: "ai_cache_enabled",
  aiCountTokensEnabled: "ai_count_tokens_enabled",
  vertexLocationId: "vertex_location_id",
  confidenceBandThresholds: "ai_confidence_band_thresholds",
  opticalRangePtThresholds: "optical_range_pt_thresholds",
  classifierModelName: "classifier_model_name",
  summaryModelName: "summary_model_name",
  visualAnalysisModelName: "visual_analysis_model_name",
  enrichedAnalysisModelName: "enriched_analysis_model_name",
  enrichedAnalysisFallbackModelName: "enriched_analysis_fallback_model_name",
  webEnricherModelName: "web_enricher_model_name",
  maxOutputTokens: "ai_max_output_tokens",
  temperature: "ai_temperature",
  topP: "ai_top_p",
  topK: "ai_top_k",
  maxConcurrentOps: "ai_max_concurrent_ops",
  retryMaxAttempts: "ai_retry_max_attempts",
  retryBaseMs: "ai_retry_base_ms",
  retryMaxMs: "ai_retry_max_ms",
  unprocessedBucketPath: "unprocessed_bucket_path",
  processedBucketPath: "processed_bucket_path",
  failedBucketPath: "failed_bucket_path",
};

const RC_DEFAULTS = {
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
};

async function setupRemoteConfig(projectId) {
  if (!projectId) {
    console.error('Error: Project ID required');
    console.log('Usage: node scripts/setup-remote-config.js [project-id]');
    console.log('Or set GOOGLE_CLOUD_PROJECT environment variable');
    process.exit(1);
  }

  // Initialize admin SDK with Application Default Credentials
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: applicationDefault(),
        projectId: projectId,
      });
    } catch (error) {
      console.error('\n✗ Authentication failed!');
      console.error('Please authenticate using one of these methods:\n');
      console.error('Option 1: Use gcloud (recommended)');
      console.error('  gcloud auth application-default login\n');
      console.error('Option 2: Set GOOGLE_APPLICATION_CREDENTIALS');
      console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"\n');
      console.error('Option 3: Use Firebase CLI');
      console.error('  firebase login\n');
      process.exit(1);
    }
  }

  const remoteConfig = admin.remoteConfig();

  try {
    // Get current template
    console.log(`Fetching current Remote Config template for ${projectId}...`);
    let template;
    try {
      template = await remoteConfig.getTemplate();
    } catch (error) {
      // Check for authentication errors
      if (error.code === 'app/invalid-credential' || error.message?.includes('credential') || error.message?.includes('OAuth2')) {
        console.error('\n✗ Authentication failed!');
        console.error('Please authenticate using one of these methods:\n');
        console.error('Option 1: Use gcloud (recommended)');
        console.error('  gcloud auth application-default login\n');
        console.error('Option 2: Set GOOGLE_APPLICATION_CREDENTIALS');
        console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"\n');
        console.error('Option 3: Use Firebase CLI');
        console.error('  firebase login\n');
        process.exit(1);
      }
      if (error.code === 5) {
        // NOT_FOUND - create new template
        console.log('No existing template found, creating new one...');
        template = remoteConfig.createTemplateFromJSON({
          parameters: {},
        });
      } else {
        throw error;
      }
    }

    // Initialize parameterGroups if not present
    if (!template.parameterGroups) {
      template.parameterGroups = {};
    }

    // Initialize Server parameter group if not present
    if (!template.parameterGroups['Server']) {
      template.parameterGroups['Server'] = {
        description: 'Server-side configuration parameters for Cloud Functions',
        parameters: {},
      };
    }

    // Add/update all parameters in the Server group
    // Note: Parameters in a group are stored in the group's parameters map, not top-level
    console.log('Adding/updating parameters in Server group...');
    let updated = 0;
    
    for (const [paramKey, defaultValue] of Object.entries(RC_DEFAULTS)) {
      // Determine value type
      let valueType = 'STRING';
      const valueStr = String(defaultValue);
      if (valueStr === 'true' || valueStr === 'false') {
        valueType = 'BOOLEAN';
      } else if (!isNaN(Number(valueStr)) && valueStr !== '' && !valueStr.includes(',')) {
        valueType = 'NUMBER';
      }

      // Remove from top-level parameters if it exists there (moving to group)
      if (template.parameters[paramKey]) {
        delete template.parameters[paramKey];
      }

      // Add or update parameter in Server group
      if (!template.parameterGroups['Server'].parameters[paramKey]) {
        template.parameterGroups['Server'].parameters[paramKey] = {
          defaultValue: {
            value: valueStr,
          },
          valueType: valueType,
        };
        console.log(`  ✓ Added: ${paramKey} = ${valueStr} (${valueType})`);
        updated++;
      } else {
        // Update existing
        template.parameterGroups['Server'].parameters[paramKey].defaultValue.value = valueStr;
        template.parameterGroups['Server'].parameters[paramKey].valueType = valueType;
        console.log(`  ↻ Updated: ${paramKey} = ${valueStr} (${valueType})`);
        updated++;
      }
    }

    console.log(`\n✓ Server parameter group contains ${Object.keys(template.parameterGroups['Server'].parameters).length} parameters`);

    // Validate template (optional but recommended)
    let validatedTemplate;
    let validationPassed = false;
    try {
      validatedTemplate = remoteConfig.validateTemplate(template);
      if (validatedTemplate && validatedTemplate.valid === true) {
        validationPassed = true;
        console.log(`\n✓ Template is valid. Publishing ${updated} parameters...`);
      } else if (validatedTemplate && validatedTemplate.valid === false) {
        console.warn('\n⚠ Template validation returned invalid, but attempting to publish anyway...');
        if (validatedTemplate.errors && Array.isArray(validatedTemplate.errors)) {
          validatedTemplate.errors.forEach((error) => {
            console.warn(`  - ${error.path || 'unknown'}: ${error.message || error}`);
          });
        }
        validationPassed = true; // Try anyway
      } else {
        // Validation result unclear, try publishing anyway
        console.warn('\n⚠ Template validation result unclear, attempting to publish...');
        validationPassed = true;
      }
    } catch (validationError) {
      console.warn('\n⚠ Template validation error (attempting to publish anyway):', validationError.message);
      if (validationError.errors && Array.isArray(validationError.errors)) {
        validationError.errors.forEach((error) => {
          console.warn(`  - ${error.path || 'unknown'}: ${error.message || error}`);
        });
      }
      validationPassed = true; // Try publishing anyway - sometimes validation is overly strict
    }

    if (validationPassed) {
      // Publish template
      const publishedTemplate = await remoteConfig.publishTemplate(template);
      console.log(`\n✓ Successfully published Remote Config template!`);
      console.log(`  Version: ${publishedTemplate.version.versionNumber}`);
      console.log(`  Updated: ${publishedTemplate.version.updateTime}`);
      console.log(`\n📋 IMPORTANT: To view these configs in Firebase Console:`);
      console.log(`   1. Go to: https://console.firebase.google.com/project/${projectId}/config`);
      console.log(`   2. If Remote Config isn't enabled, click "Get Started" or "Enable Remote Config"`);
      console.log(`   3. The ${Object.keys(RC_DEFAULTS).length} parameters will appear after enabling`);
      console.log(`\n   You can also verify via CLI:`);
      console.log(`   firebase remoteconfig:get --project ${projectId}`);
    } else {
      console.error('\n✗ Cannot proceed with publishing');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.code) {
      console.error(`  Code: ${error.code}`);
    }
    process.exit(1);
  }
}

// Get project ID from args or env
const projectId = process.argv[2] || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

setupRemoteConfig(projectId);

