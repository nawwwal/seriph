#!/usr/bin/env bash
set -euo pipefail

# Simple E2E benchmark workflow for Firebase Emulator Suite
# Requirements: firebase-tools installed and configured; functions emulator; storage & firestore emulators
#
# Usage: ./scripts/run-emulator-benchmark.sh <PROJECT_ID>
#
# Steps:
# 1. Start emulators in another terminal:
#    firebase emulators:start --project "${PROJECT_ID}" --only functions,firestore,storage
# 2. Upload a sample font to the unprocessed path in the emulator storage bucket.
# 3. Observe function logs; timings are also written to Firestore collection `metrics_ai`.

PROJECT_ID="${1:-demo-seriph}"
UNPROCESSED_PATH="${UNPROCESSED_PATH:-unprocessed_fonts}"
SAMPLE_FONT="${SAMPLE_FONT:-./samples/Roboto-Regular.ttf}"

echo "Project: ${PROJECT_ID}"
echo "Unprocessed path: ${UNPROCESSED_PATH}"
echo "Sample font: ${SAMPLE_FONT}"

if [ ! -f "${SAMPLE_FONT}" ]; then
  echo "Sample font not found at ${SAMPLE_FONT}"; exit 1
fi

PROCESSING_ID="$(date +%s)"
BASENAME="$(basename "${SAMPLE_FONT}")"
TARGET_PATH="${UNPROCESSED_PATH}/${PROCESSING_ID}-${BASENAME}"

echo "Uploading ${SAMPLE_FONT} to emulator bucket path ${TARGET_PATH}"
gsutil -o "GSUtil:parallel_composite_upload_threshold=150M" cp "${SAMPLE_FONT}" "gs://${PROJECT_ID}.appspot.com/${TARGET_PATH}"

echo "Done. Check emulator logs and Firestore 'metrics_ai/${PROCESSING_ID}' for timings."


