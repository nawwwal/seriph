#!/usr/bin/env bash
set -euo pipefail

PROJECT=""
STORAGE_BUCKET=""
DRY_RUN=0
REGION="asia-southeast1"
QUEUE="seriph-import"
SERVICE="seriph-archive-worker"
REPOSITORY="seriph"
TASK_SERVICE_ACCOUNT_NAME="import-task-service-account"
WORKER_SERVICE_ACCOUNT_NAME="archive-worker-service-account"
STORAGE_ROLE_ID="archiveWorkerStorage"
STORAGE_ROLE_PERMISSIONS="storage.objects.get,storage.objects.list,storage.objects.create,storage.objects.update"

usage() {
  printf 'Usage: %s --project PROJECT [--bucket STORAGE_BUCKET] [--dry-run]\n' "$0"
}

while (($# > 0)); do
  case "$1" in
    --project)
      (($# >= 2)) || { usage >&2; exit 2; }
      PROJECT="$2"
      shift 2
      ;;
    --bucket)
      (($# >= 2)) || { usage >&2; exit 2; }
      STORAGE_BUCKET="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

[[ -n "$PROJECT" ]] || { usage >&2; exit 2; }
if [[ -z "$STORAGE_BUCKET" ]]; then
  STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET:-${GOOGLE_CLOUD_STORAGE_BUCKET:-${PROJECT}.firebasestorage.app}}"
fi

TASK_SERVICE_ACCOUNT="${TASK_SERVICE_ACCOUNT_NAME}@${PROJECT}.iam.gserviceaccount.com"
WORKER_SERVICE_ACCOUNT="${WORKER_SERVICE_ACCOUNT_NAME}@${PROJECT}.iam.gserviceaccount.com"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPOSITORY}/${SERVICE}:latest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
FUNCTIONS_ENV_FILE="${ROOT_DIR}/functions/.env.${PROJECT}"
FUNCTIONS_WORKER_URL="https://${REGION}-${PROJECT}.cloudfunctions.net/importTaskWorker"
FUNCTIONS_WORKER_HOST="${REGION}-${PROJECT}.cloudfunctions.net"

run() {
  printf '+ '
  printf '%q ' "$@"
  printf '\n'
  if ((DRY_RUN == 0)); then "$@"; fi
}

upsert_env() {
  local key="$1" value="$2" file="$3"
  local tmp="${file}.tmp"
  mkdir -p "$(dirname "$file")"
  if [[ -f "$file" ]]; then
    awk -v key="$key" -v value="$value" 'BEGIN { found = 0 } index($0, key "=") == 1 { print key "=" value; found = 1; next } { print } END { if (!found) print key "=" value }' "$file" > "$tmp"
  else
    printf '%s=%s\n' "$key" "$value" > "$tmp"
  fi
  mv "$tmp" "$file"
}

provision_functions_env() {
  local key="$1" value="$2"
  if ((DRY_RUN == 1)); then
    printf '+ update %s with %s=%s\n' "$FUNCTIONS_ENV_FILE" "$key" "$value"
  else
    upsert_env "$key" "$value" "$FUNCTIONS_ENV_FILE"
  fi
}

provision_functions_env IMPORT_TASKS_LOCATION "$REGION"
provision_functions_env IMPORT_TASKS_QUEUE "$QUEUE"
provision_functions_env IMPORT_WORKER_URL "$FUNCTIONS_WORKER_URL"
provision_functions_env IMPORT_WORKER_ALLOWED_HOSTS "$FUNCTIONS_WORKER_HOST"
provision_functions_env IMPORT_WORKER_SERVICE_ACCOUNT "$TASK_SERVICE_ACCOUNT"
provision_functions_env IMPORT_TASKS_SERVICE_ACCOUNT "$TASK_SERVICE_ACCOUNT"

if ((DRY_RUN == 1)); then
  run gcloud services enable cloudtasks.googleapis.com run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --project "$PROJECT"
  run gcloud tasks queues create "$QUEUE" --location "$REGION" --max-dispatches-per-second 4 --max-concurrent-dispatches 4 --project "$PROJECT"
  run gcloud artifacts repositories create "$REPOSITORY" --location "$REGION" --repository-format docker --project "$PROJECT"
  run gcloud iam service-accounts create "$TASK_SERVICE_ACCOUNT_NAME" --display-name "Seriph import task service account" --project "$PROJECT"
  run gcloud iam service-accounts create "$WORKER_SERVICE_ACCOUNT_NAME" --display-name "Seriph archive worker service account" --project "$PROJECT"
  run gcloud iam roles create "$STORAGE_ROLE_ID" --project "$PROJECT" --title "Seriph archive worker storage" --description "Non-destructive object access for the archive worker" --permissions "$STORAGE_ROLE_PERMISSIONS" --stage GA
else
  run gcloud services enable cloudtasks.googleapis.com run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --project "$PROJECT"
  if ! gcloud tasks queues describe "$QUEUE" --location "$REGION" --project "$PROJECT" >/dev/null 2>&1; then
    run gcloud tasks queues create "$QUEUE" --location "$REGION" --max-dispatches-per-second 4 --max-concurrent-dispatches 4 --project "$PROJECT"
  else
    run gcloud tasks queues update "$QUEUE" --location "$REGION" --max-dispatches-per-second 4 --max-concurrent-dispatches 4 --project "$PROJECT"
  fi
  if ! gcloud artifacts repositories describe "$REPOSITORY" --location "$REGION" --project "$PROJECT" >/dev/null 2>&1; then
    run gcloud artifacts repositories create "$REPOSITORY" --location "$REGION" --repository-format docker --project "$PROJECT"
  fi
  if ! gcloud iam service-accounts describe "$TASK_SERVICE_ACCOUNT" --project "$PROJECT" >/dev/null 2>&1; then
    run gcloud iam service-accounts create "$TASK_SERVICE_ACCOUNT_NAME" --display-name "Seriph import task service account" --project "$PROJECT"
  fi
  if ! gcloud iam service-accounts describe "$WORKER_SERVICE_ACCOUNT" --project "$PROJECT" >/dev/null 2>&1; then
    run gcloud iam service-accounts create "$WORKER_SERVICE_ACCOUNT_NAME" --display-name "Seriph archive worker service account" --project "$PROJECT"
  fi
  if gcloud iam roles describe "$STORAGE_ROLE_ID" --project "$PROJECT" >/dev/null 2>&1; then
    run gcloud iam roles update "$STORAGE_ROLE_ID" --project "$PROJECT" --title "Seriph archive worker storage" --description "Non-destructive object access for the archive worker" --permissions "$STORAGE_ROLE_PERMISSIONS" --stage GA
  else
    run gcloud iam roles create "$STORAGE_ROLE_ID" --project "$PROJECT" --title "Seriph archive worker storage" --description "Non-destructive object access for the archive worker" --permissions "$STORAGE_ROLE_PERMISSIONS" --stage GA
  fi
fi

run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:${WORKER_SERVICE_ACCOUNT}" --role roles/datastore.user --condition=None
run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:${WORKER_SERVICE_ACCOUNT}" --role roles/cloudconfig.viewer --condition=None
run gcloud storage buckets add-iam-policy-binding "gs://${STORAGE_BUCKET}" --member "serviceAccount:${WORKER_SERVICE_ACCOUNT}" --role "projects/${PROJECT}/roles/${STORAGE_ROLE_ID}" --project "$PROJECT"
run gcloud tasks queues add-iam-policy-binding "$QUEUE" --location "$REGION" --member "serviceAccount:${WORKER_SERVICE_ACCOUNT}" --role roles/cloudtasks.enqueuer --project "$PROJECT"

run gcloud builds submit "${ROOT_DIR}/functions" --config "${ROOT_DIR}/functions/cloudbuild.archive-worker.yaml" --substitutions "_IMAGE=${IMAGE}" --project "$PROJECT"
run gcloud run deploy "$SERVICE" --image "$IMAGE" --region "$REGION" --project "$PROJECT" --service-account "$WORKER_SERVICE_ACCOUNT" --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT},IMPORT_TASKS_LOCATION=${REGION},IMPORT_TASKS_QUEUE=${QUEUE},IMPORT_TASKS_SERVICE_ACCOUNT=${TASK_SERVICE_ACCOUNT},FIREBASE_STORAGE_BUCKET=${STORAGE_BUCKET}" --memory=1Gi --cpu=2 --concurrency=1 --timeout=900 --no-allow-unauthenticated
run gcloud run services add-iam-policy-binding "$SERVICE" --region "$REGION" --project "$PROJECT" --member "serviceAccount:${TASK_SERVICE_ACCOUNT}" --role roles/run.invoker

if ((DRY_RUN == 1)); then
  printf '+ update %s with IMPORT_ARCHIVE_WORKER_URL=<Cloud Run status.url> and IMPORT_ARCHIVE_WORKER_ALLOWED_HOSTS=<Cloud Run hostname>\n' "$FUNCTIONS_ENV_FILE"
else
  ARCHIVE_URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format='value(status.url)')"
  [[ -n "$ARCHIVE_URL" ]] || { printf 'Cloud Run returned no service URL.\n' >&2; exit 1; }
  upsert_env IMPORT_ARCHIVE_WORKER_URL "$ARCHIVE_URL/import" "$FUNCTIONS_ENV_FILE"
  upsert_env IMPORT_ARCHIVE_WORKER_ALLOWED_HOSTS "$(printf '%s' "$ARCHIVE_URL" | sed -E 's#^https://##; s#/.*$##')" "$FUNCTIONS_ENV_FILE"
  printf 'Updated %s. Redeploy Functions with: firebase deploy --only functions\n' "$FUNCTIONS_ENV_FILE"
fi

if ((DRY_RUN == 1)); then
  printf 'Dry run only: no GCP resources were changed.\n'
else
  printf 'Configured %s in %s for project %s.\n' "$SERVICE" "$REGION" "$PROJECT"
fi
