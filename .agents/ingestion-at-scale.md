# Ingestion at Scale + Upload Status

How Seriph ingests a real "attic" of fonts (loose files, zips, nested folders)
and how upload/analysis status is modeled and surfaced. Read before touching the
upload journey, the ingest state machine, or the Storage-triggered functions.

## Event-driven, recursive pipeline

```
Client (folder walk + resumable upload, files as-is)
        ↓ intake/{batchId}/{processingId}-{name}  (customMetadata: ownerId, batchId, relPath, processingId)
expandArchive  (onObjectFinalized, intake prefix)
   • font → create ingest if needed → copy to unprocessed_fonts/**  ──▶ processUploadedFontStorage
   • zip  → unzip; fonts emitted, nested zips written back to intake/** (recurse, depth ≤ 4)
   • zip > 150MB → skipped + ledger `oversized`  (TODO: Cloud Run job, Phase 3)
   • other → ignored + ledger `skipped`
processUploadedFontStorage → parse/hash/group → family `ready` → enrichFontOnReady → finalize ingests
```

Why recursive: extracted entries re-enter `intake/**`, so nested zips and deep
folders fall out structurally — no special cases.

### Key files
- Client walk: `utils/walkDirectoryEntries.ts` (drag-drop entries API +
  `webkitdirectory` input → `WalkedFile[]` with relative paths).
- Resumable upload: `lib/hooks/useResumableBatchUpload.ts` (registers in chunks
  of 100, uploads to `intake/**` with bounded concurrency, drives live progress).
- Dropzone folder support: `components/ui/Dropzone.tsx` (`allowFolders`,
  `onFilesWalked`).
- Register: `app/api/upload/register/route.ts` (accepts any type into
  `intake/{batchId}/...`, `pending` state, contentHash dup check, returns batchId).
- Expander: `functions/src/ingest/expandArchive.ts` + `expandArchive` trigger in
  `functions/src/index.ts`. RC key `intake_bucket_path` (default `intake`).
- Dedup: content-hash gate in `emitFont` (skips fonts the user already has).
- Batch ledger: `users/{uid}/batches/{batchId}` counters (fonts/zips/dupes/
  skipped/oversized) via `FieldValue.increment`.

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
- `processUploadedFontStorage`: `queued` → `analyzing` (before parse) →
  `enriching` (after parse; stays visible) — see `functions/src/index.ts`.
- `enrichFontOnReady`: runs enrichment, then `finalizeIngestsForFamily(slug)` in
  a `finally` marks the originating ingest(s) `complete` even if enrichment is
  disabled/fails.

## Global Upload Center

- `lib/contexts/UploadContext.tsx` (`UploadProvider`, wired in `app/layout.tsx`
  inside `AuthProvider`) owns the live ingest snapshot, the client progress map,
  active count, and modal open state. Replaces the per-page snapshot listeners.
- `components/upload/UploadCenterModal.tsx` — openable from anywhere via the
  NavBar "Uploads" button (badge = active count); per-item progress + stage,
  filters, mutually-exclusive stats. `BatchHUD` is now a thin floating shortcut
  that opens it. The import page is a thin launcher; live status lives here.

## Deploy / ops notes (required for Part B to run)
- Deploy the new `expandArchive` function (gen2, `asia-southeast1`).
- Storage rules must allow authed users to write `intake/**` (resumable client
  uploads). Confirm/extend `storage.rules`.
- Add Remote Config key `intake_bucket_path` (default `intake`) if overriding.
- The `enrichFontOnReady` finalize uses a `collectionGroup('ingests')` query on
  `familyId` — ensure that collection-group index exists.
- **Phase 3 (not built):** Cloud Run job for zips > 150MB (currently skipped +
  ledgered `oversized`) and Cloud Tasks/Pub-Sub backpressure on enrichment.
  Configure rates via Remote Config; no hardcoded values.
