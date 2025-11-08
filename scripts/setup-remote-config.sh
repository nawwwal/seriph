#!/bin/bash
# Script to set up Remote Config parameters via CLI
# Usage: ./scripts/setup-remote-config.sh [project-id]

set -e

PROJECT_ID="${1:-$(firebase use | grep -oP '(?<=\()[^)]+')}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: Project ID required. Usage: $0 [project-id]"
  exit 1
fi

echo "Setting up Remote Config for project: $PROJECT_ID"

# Download current template
echo "Downloading current Remote Config template..."
firebase remoteconfig:get --project "$PROJECT_ID" > remote-config-template.json

# Check if file exists and has content
if [ ! -s remote-config-template.json ]; then
  echo "Creating new Remote Config template..."
  cat > remote-config-template.json << 'EOF'
{
  "parameters": {},
  "version": {
    "versionNumber": "0",
    "updateTime": "2024-01-01T00:00:00Z",
    "updateUser": {
      "email": "cli@firebase"
    },
    "description": "Initial template",
    "updateOrigin": "REST_API",
    "updateType": "INCREMENTAL_UPDATE"
  }
}
EOF
fi

# Create a script that adds all parameters
cat > add-remote-config-params.sh << 'SCRIPT'
#!/bin/bash
# This script adds all Remote Config parameters
# Run: bash add-remote-config-params.sh

TEMPLATE_FILE="remote-config-template.json"

# Function to add a parameter
add_param() {
  local key=$1
  local value=$2
  local value_type=${3:-STRING}
  
  echo "Adding parameter: $key = $value (type: $value_type)"
  
  # Use jq to add parameter to template
  if command -v jq &> /dev/null; then
    jq --arg key "$key" --arg value "$value" --arg type "$value_type" \
      '.parameters[$key] = {
        "defaultValue": {
          "value": $value
        },
        "valueType": $type
      }' "$TEMPLATE_FILE" > "${TEMPLATE_FILE}.tmp" && mv "${TEMPLATE_FILE}.tmp" "$TEMPLATE_FILE"
  else
    echo "Warning: jq not found. Install it with: brew install jq"
    echo "Or manually edit remote-config-template.json"
  fi
}

# Add all parameters from rcKeys.ts defaults
add_param "is_vertex_enabled" "false" "BOOLEAN"
add_param "web_enrichment_enabled" "false" "BOOLEAN"
add_param "ai_cache_enabled" "true" "BOOLEAN"
add_param "ai_count_tokens_enabled" "false" "BOOLEAN"
add_param "vertex_location_id" "asia-southeast1" "STRING"
add_param "ai_confidence_band_thresholds" "0.2,0.6,0.85" "STRING"
add_param "optical_range_pt_thresholds" "9,18,36" "STRING"
add_param "classifier_model_name" "gemini-2.5-flash" "STRING"
add_param "summary_model_name" "gemini-2.5-flash" "STRING"
add_param "visual_analysis_model_name" "gemini-2.5-flash" "STRING"
add_param "enriched_analysis_model_name" "gemini-2.5-flash" "STRING"
add_param "enriched_analysis_fallback_model_name" "gemini-2.5-flash" "STRING"
add_param "web_enricher_model_name" "gemini-2.5-flash" "STRING"
add_param "ai_max_output_tokens" "1536" "NUMBER"
add_param "ai_temperature" "0.4" "NUMBER"
add_param "ai_top_p" "0.9" "NUMBER"
add_param "ai_top_k" "40" "NUMBER"
add_param "ai_max_concurrent_ops" "4" "NUMBER"
add_param "ai_retry_max_attempts" "3" "NUMBER"
add_param "ai_retry_base_ms" "250" "NUMBER"
add_param "ai_retry_max_ms" "4000" "NUMBER"
add_param "unprocessed_bucket_path" "unprocessed_fonts" "STRING"
add_param "processed_bucket_path" "processed_fonts" "STRING"
add_param "failed_bucket_path" "failed_processing" "STRING"

echo "Parameters added to template. Review remote-config-template.json"
echo "Then publish with: firebase remoteconfig:publish --project $PROJECT_ID"
SCRIPT

chmod +x add-remote-config-params.sh

echo ""
echo "Next steps:"
echo "1. Run: bash add-remote-config-params.sh"
echo "2. Review: remote-config-template.json"
echo "3. Publish: firebase remoteconfig:publish --project $PROJECT_ID"

