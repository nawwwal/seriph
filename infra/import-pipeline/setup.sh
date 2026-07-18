#!/usr/bin/env bash
set -euo pipefail

PROJECT=""
DRY_RUN=0
REGION="asia-southeast1"
QUEUE="seriph-import"
SERVICE="seriph-archive-worker"
REPOSITORY="seriph"
TASK_SERVICE_ACCOUNT_NAME="import-task-service-account"
WORKER_SERVICE_ACCOUNT_NAME="archive-worker-service-account"

usage() {
  printf 'Usage: %s --project PROJECT [--dry-run]\n' "$0"
}

while (($# > 0)); do
  case "$1" in
    --project)
      (($# >= 2)) || { usage >&2; exit 2; }
      PROJECT="$2"
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

TASK_SERVICE_ACCOUNT="${TASK_SERVICE_ACCOUNT_NAME}@${PROJECT}.iam.gserviceaccount.com"
WORKER_SERVICE_ACCOUNT="${WORKER_SERVICE_ACCOUNT_NAME}@${PROJECT}.iam.gserviceaccount.com"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPOSITORY}/${SERVICE}:latest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

run() {
  printf '+ '
  printf '%q ' "$@"
  printf '\n'
  if ((DRY_RUN == 0)); then "$@"; fi
}

if ((DRY_RUN == 1)); then
  run gcloud services enable cloudtasks.googleapis.com run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --project "$PROJECT"
  run gcloud tasks queues create "$QUEUE" --location "$REGION" --max-dispatches-per-second 4 --max-concurrent-dispatches 4 --project "$PROJECT"
  run gcloud artifacts repositories create "$REPOSITORY" --location "$REGION" --repository-format docker --project "$PROJECT"
  run gcloud iam service-accounts create "$TASK_SERVICE_ACCOUNT_NAME" --display-name "Seriph import task service account" --project "$PROJECT"
  run gcloud iam service-accounts create "$WORKER_SERVICE_ACCOUNT_NAME" --display-name "Seriph archive worker service account" --project "$PROJECT"
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
fi

for ROLE in roles/datastore.user roles/storage.objectAdmin roles/cloudtasks.enqueuer; do
  run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:${WORKER_SERVICE_ACCOUNT}" --role "$ROLE"
done

run gcloud builds submit "${ROOT_DIR}/functions" --file Dockerfile.archive-worker --tag "$IMAGE" --project "$PROJECT"
run gcloud run deploy "$SERVICE" --image "$IMAGE" --region "$REGION" --project "$PROJECT" --service-account "$WORKER_SERVICE_ACCOUNT" --set-env-vars "IMPORT_TASKS_SERVICE_ACCOUNT=${TASK_SERVICE_ACCOUNT}" --memory=1Gi --cpu=2 --concurrency=1 --timeout=900 --no-allow-unauthenticated
run gcloud run services add-iam-policy-binding "$SERVICE" --region "$REGION" --project "$PROJECT" --member "serviceAccount:${TASK_SERVICE_ACCOUNT}" --role roles/run.invoker

if ((DRY_RUN == 1)); then
  printf 'Dry run only: no GCP resources were changed.\n'
else
  printf 'Configured %s in %s for project %s.\n' "$SERVICE" "$REGION" "$PROJECT"
fi
