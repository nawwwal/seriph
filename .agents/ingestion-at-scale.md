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

Two independent lanes; the legacy `status` field is no longer used for display.
- **Upload:** `pending → uploading → uploaded` (+ `failed`/`canceled`), with a
  client-driven `uploadProgress` 0-100.
- **Analysis:** `not_started → queued → analyzing → enriching → complete`
  (+ `error`/`quarantined`).

`getCombinedStatus(uploadState, analysisState, uploadProgress)` in
`lib/contexts/ImportContext.tsx` returns the single canonical `stage`,
`displayText`, `priority`, and an overall `percent` (upload = first 50%, analysis
= second 50%). A client `uploadProgress` in (0,100) is treated as `uploading`
even while the doc still says `pending` (no client Firestore writes needed).

Server emits the real stages:
The canonical import feed emits durable batch/source/item/family-plan stages;
enrichment is a separate batch lane and never blocks catalogue visibility.

## Global Upload Center

- `lib/contexts/UploadContext.tsx` (`UploadProvider`, wired in `app/layout.tsx`
  inside `AuthProvider`) owns the live ingest snapshot, the client progress map,
  active count, and modal open state. Replaces the per-page snapshot listeners.
- `components/upload/UploadCenterModal.tsx` — openable from anywhere via the
  NavBar "Uploads" button (badge = active count); per-item progress + stage,
  filters, mutually-exclusive stats. `BatchHUD` is now a thin floating shortcut
  that opens it. The import page is a thin launcher; live status lives here.

## Deploy / ops notes (required for Part B to run)
- Deploy the durable source-finalization, task-worker, and timeout functions
  (gen2, `asia-southeast1`).
- Storage rules must allow authed users to write `intake/**` (resumable client
  uploads). Confirm/extend `storage.rules`.
- Add Remote Config key `intake_bucket_path` (default `intake`) if overriding.
- The `enrichFontOnReady` finalize uses a `collectionGroup('ingests')` query on
  `familyId` — ensure that collection-group index exists.
- **Phase 3 (not built):** Cloud Run job for zips > 150MB (currently skipped +
  ledgered `oversized`) and Cloud Tasks/Pub-Sub backpressure on enrichment.
  Configure rates via Remote Config; no hardcoded values.
