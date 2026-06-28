#!/usr/bin/env bash
#
# Provisions the public, CDN-served font bucket for Seriph's rebuilt catalog.
# Idempotent: safe to re-run. Requires an authenticated gcloud (`gcloud auth login`).
#
# Usage: ./scripts/setup-catalog.sh [PROJECT_ID] [BUCKET] [LOCATION]
set -euo pipefail

PROJECT_ID="${1:-seriph}"
BUCKET="${2:-seriph-fonts}"
LOCATION="${3:-asia-southeast1}"

echo "Project: $PROJECT_ID  Bucket: gs://$BUCKET  Location: $LOCATION"

# 1) Create the public served bucket (uniform bucket-level access).
if gcloud storage buckets describe "gs://$BUCKET" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Bucket already exists; skipping create."
else
  gcloud storage buckets create "gs://$BUCKET" \
    --project="$PROJECT_ID" \
    --location="$LOCATION" \
    --uniform-bucket-level-access
fi

# 2) Make objects publicly readable (this is the "publish" step — fonts become
#    world-readable by URL, which is the intended Google-Fonts-style CDN behavior).
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --project="$PROJECT_ID" \
  --member="allUsers" \
  --role="roles/storage.objectViewer"

# 3) Allow the Cloud Functions runtime service account to write canonical assets.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${SA}" \
  --role="roles/storage.objectAdmin"

# 4) CORS so browsers (and the CSS API consumers) can fetch fonts cross-origin.
CORS_FILE="$(mktemp)"
cat >"$CORS_FILE" <<'JSON'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
JSON
gcloud storage buckets update "gs://$BUCKET" --project="$PROJECT_ID" --cors-file="$CORS_FILE"
rm -f "$CORS_FILE"

echo "Done. Set Remote Config 'catalog_public_bucket'=$BUCKET (default already matches)."
echo "If using a custom domain, set 'catalog_cdn_base_url' (e.g. https://fonts.seriph.app)."
