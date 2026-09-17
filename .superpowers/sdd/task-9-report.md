# Task 9 report

## Status

Implemented source registration, sealing, and terminal client-upload failure commands on the Task 8 batch API branch.

## RED / GREEN evidence

- RED prerequisite: the new worktree initially had no local Vitest binary.
- Installed locked dependencies with `npm ci --ignore-scripts`.
- RED: `npm test -- tests/importSourceApi.test.ts` then failed as intended because `@/lib/server/imports/sourceCommands` did not exist.
- GREEN: `npm test -- tests/importSourceApi.test.ts` passes: 6 tests, 1 file, 0 failures.
- Typecheck: `npm run typecheck` passes.
- Scope checks: `git diff --check` passes and all five source/test files are below 100 non-empty lines (44, 17, 11, 13, 46).

## Changed files

- `lib/server/imports/sourceCommands.ts`
- `app/api/v1/import-batches/[batchId]/sources/route.ts`
- `app/api/v1/import-batches/[batchId]/seal/route.ts`
- `app/api/v1/import-batches/[batchId]/sources/[sourceId]/failure/route.ts`
- `tests/importSourceApi.test.ts`

## Behavior covered

- Each submitted selection receives a durable source record, including terminal size/path/request-cap rejections.
- Paths retain the submitted spelling and a normalized separator form; absolute and traversal paths are rejected.
- Accepted registrations return `uploading` authorization and the exact intake storage path.
- Repeated source registrations are idempotent and do not increment the source counter twice.
- Seal rejects a count mismatch, then returns `sealed` and subsequently `existing`.
- Only `upload_failed` and `canceled` terminal client states are accepted; client detail is stored separately and reconciliation is scheduled.

## Self-review

- Routes authenticate before resolving route params or invoking lookups, and only parse/delegate/map command results.
- Firestore reads occur before writes inside command transactions.
- The commit excludes this report, existing Task 8 report, dependencies, and all unrelated dirty changes.

## Checker follow-up: exact RED / GREEN evidence

- RED command: `npm test -- tests/importSourceApi.test.ts`
- RED result: 8 tests ran; 3 failed. The failures showed `[201]` source writes instead of `[200, 1]`, accepted `C:\\private\\Font.zip`, and omitted duplicate/non-canonical-ID terminal error codes.
- GREEN command: `npm test -- tests/importSourceApi.test.ts && npm run typecheck`
- GREEN result: 8 tests passed in 1 file; `tsc --noEmit` passed.
- Follow-up scope checks: `node scripts/check-line-count.mjs`, non-empty-line counts, and `git diff --check` passed.

## Checker follow-up behavior

- Registration partitions selections into deterministic groups of 200. Every group contains at most 200 source-document writes; selections after index 199 are persisted as terminal `request_source_limit` source records instead of receiving upload authorization.
- The validator treats `C:\\...` and `C:/...` as absolute paths while preserving both submitted `relativePath` and normalized `normalizedRelativePath` in the terminal source record.
- Only canonical lowercase UUID source IDs are used to form Firestore or Storage paths. Invalid and same-request duplicate IDs receive explicit terminal results and are kept in deterministic rejection inventory records, without incrementing the source counter.

## Remaining-blocker follow-up: exact RED / GREEN evidence

- RED command: `npm test -- tests/importSourceApi.test.ts`
- RED result: 11 tests ran; 3 failed. A changed invalid entry replayed `bad/a` from the index-keyed rejection document, a sealed batch returned an uploading registration, and `failureResponse` was absent.
- GREEN command: `npm test -- tests/importSourceApi.test.ts && npm run typecheck`
- GREEN result: 11 tests passed in 1 file; `tsc --noEmit` passed.

## Remaining-blocker behavior

- Rejection inventory IDs are SHA-256 fingerprints of normalized source ID, name, path, size, declared type, and duplicate occurrence. Exact retries reuse the same terminal record; different invalid selections cannot collide solely by position.
- Every registration transaction reads `sealed` before any source or rejection reference is read or write is issued. A sealed batch returns `{ kind: "batch_sealed" }` without authorizing or persisting new selections.
- The terminal-failure route maps `invalid_source_id` to a `bad_request` response before any Firestore mutation can occur.

## Event timestamp follow-up: exact RED / GREEN evidence

- RED command: `npm test -- tests/importSourceApi.test.ts`
- RED result: 12 tests ran; the new event timestamp assertion failed because `ServerTimestampTransform` values were nested in the persisted event array.
- GREEN command: `npm test -- tests/importSourceApi.test.ts && npm run typecheck`
- GREEN result: 12 tests passed in 1 file; `tsc --noEmit` passed.

## Event timestamp behavior

- Source document fields continue to use `FieldValue.serverTimestamp()` where transforms are legal. Event-array entries now use a concrete transaction-local `Timestamp.now()` value, so Firestore can serialize every event item.
