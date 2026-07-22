# Durable Ingestion + Upload Status

How Seriph ingests a real "attic" of fonts (loose files, zips, nested folders)
through durable import batches and how status is modeled and surfaced. Read
before touching the upload journey, import state machine, or Storage triggers.

## Durable import pipeline

```
Client walks files and creates one durable import batch.
        ↓ register sources, seal batch, upload to intake/{ownerId}/{batchId}/{sourceId}/{filename}
confirmFinalizedImportSource  (onObjectFinalized, registered source path)
        ↓ enqueue durable archive/parse/plan/apply tasks
importTaskWorker → dispatches idempotent stages → canonical catalogue mutations
        ↓
submitEnrichmentBatch / pollEnrichmentBatch → enrich canonical families
```

Why recursive: extracted entries re-enter `intake/**`, so nested zips and deep
folders fall out structurally — no special cases.

### Key files
- Client walk: `utils/walkDirectoryEntries.ts` (drag-drop entries API +
  `webkitdirectory` input → `WalkedFile[]` with relative paths).
- Durable upload: `lib/hooks/useDurableBatchUpload.ts` (registers, seals,
  uploads with persisted source IDs, and drives live progress).
- Dropzone folder support: `components/ui/Dropzone.tsx` (`allowFolders`,
  `onFilesWalked`).
- Batch/source APIs: `app/api/v1/import-batches/**` and
  `lib/imports/importBatchApi.ts`.
- Reconciler: `functions/src/imports/reconcile/**` and
  `functions/src/imports/tasks/**`.
- Durable archive worker: `functions/src/imports/archiveWorker/**`.

## Upload/analysis state machine (single source of truth)

The durable import batch feed is the source of truth; the legacy `status` field
is no longer used for display.
- **Upload:** `pending → uploading → uploaded` (+ `failed`/`canceled`), with a
  client-driven `uploadProgress` 0-100.
- **Analysis:** `not_started → queued → analyzing → enriching → complete`
  (+ `error`/`quarantined`).

`lib/contexts/UploadContext.tsx` owns the global upload state and client
progress map. `lib/hooks/useImportBatchFeed.ts` drives the realtime batch feed
with the API as its fallback, mapping durable `ImportBatchSummary` records and
their upload, planning, and enrichment phases. Enrichment is a separate batch
lane and never blocks catalogue visibility.

## Global import surface

- `lib/contexts/UploadContext.tsx` (`UploadProvider`, wired in `app/layout.tsx`
  inside `AuthProvider`) owns the live ingest snapshot, the client progress map,
  active count, import picker state, and cancellation handle. It replaces
  route-local snapshot listeners and upload state.
- `components/upload/ImportOverlay.tsx` mounts `UploadSurface`, the compact
  picker, and one bottom `UploadTray`. Dragging files anywhere starts a durable
  import. The tray shows plain phases, progress, cancel, and actionable failures;
  the shelf, sidebar, and footer do not duplicate that state.

## Deploy / ops notes (required for Part B to run)
- Deploy the durable source-finalization, task-worker, and timeout functions
  (gen2, `asia-southeast1`).
- Storage rules must allow authed users to write `intake/**` (resumable client
  uploads). Confirm/extend `storage.rules`.
- Add Remote Config key `intake_bucket_path` (default `intake`) if overriding.
- `confirmFinalizedImportSource` validates finalized intake objects and enqueues
  canonical work for `importTaskWorker`; `timeoutAbandonedImportSources` expires
  stale source records. Deploy all three functions together.
- Deploy the current `firestore.indexes.json` entries for `importBatches`,
  `sources`, `families`, `items`, and the top-level `fontfamilies` vector
  queries. Vector definitions belong in `indexes`, not `fieldOverrides`.
- **Phase 3 (not built):** Cloud Run job for zips > 150MB (currently skipped +
  ledgered `oversized`) and Cloud Tasks/Pub-Sub backpressure on enrichment.
  Configure rates via Remote Config; no hardcoded values.
