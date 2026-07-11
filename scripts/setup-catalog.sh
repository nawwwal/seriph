#!/usr/bin/env bash
#
# Provisions the font catalog bucket for Seriph.
# Fonts are served via Cloud Functions (Hosting /s, /d, /css2) using the Admin SDK.
# Objects are NOT world-readable by default.
#
# Usage:
#   ./scripts/setup-catalog.sh [PROJECT_ID] [BUCKET] [LOCATION]
#   PUBLIC=1 ./scripts/setup-catalog.sh   # opt-in: allUsers objectViewer (direct GCS URLs)
#
set -euo pipefail

PROJECT_ID="${1:-seriph}"
BUCKET="${2:-seriph-fonts}"
LOCATION="${3:-asia-southeast1}"
PUBLIC="${PUBLIC:-0}"

echo "Project: $PROJECT_ID  Bucket: gs://$BUCKET  Location: $LOCATION  PUBLIC=$PUBLIC"

if gcloud storage buckets describe "gs://$BUCKET" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Bucket already exists; skipping create."
else
  gcloud storage buckets create "gs://$BUCKET" \
    --project="$PROJECT_ID" \
    --location="$LOCATION" \
    --uniform-bucket-level-access
fi

# Runtime SA write access (Cloud Functions default compute SA).
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${SA}" \
  --role="roles/storage.objectAdmin"

# Opt-in public read (direct storage.googleapis.com URLs). Prefer Hosting rewrites.
if [[ "$PUBLIC" == "1" ]]; then
  echo "WARNING: making gs://$BUCKET readable by allUsers (world-readable font bytes)."
  gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
    --project="$PROJECT_ID" \
    --member="allUsers" \
    --role="roles/storage.objectViewer"
else
  # Ensure public binding is not present (safe if already absent).
  gcloud storage buckets remove-iam-policy-binding "gs://$BUCKET" \
    --project="$PROJECT_ID" \
    --member="allUsers" \
    --role="roles/storage.objectViewer" >/dev/null 2>&1 || true
  echo "Public objectViewer not applied. Serve via https://seriph.web.app/s|d|css2 only."
fi

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

echo "Done. Remote Config catalog_public_bucket=$BUCKET (serving still uses Admin SDK)."
