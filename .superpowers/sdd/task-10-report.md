# Task 10 report

Status: implemented in isolated worktree `/Users/adi/projects/seriph-task-10`.

Commit: `48b4411 feat: upload sources through durable batches`

## RED

Command: `npm test -- tests/durableBatchUpload.test.ts`

Result: exit 1. The new test failed with
`Cannot find package '@/lib/hooks/useDurableBatchUpload'`, proving the durable
controller did not exist before implementation. (The first invocation also
found the isolated worktree lacked its ignored dependency link; no source was
changed, and the valid RED run used the shared installed dependencies.)

## GREEN

- `npm test -- tests/durableBatchUpload.test.ts` — 1 test passed.
- `npm test -- tests/durableBatchUpload.test.ts tests/importRouteBoundary.test.ts` — 2 files and 4 tests passed.
- `npm run typecheck` — passed.
- `npm run lint:lines` — passed.
- `git diff --check` and staged `git diff --cached --check` — passed.
- Non-empty-line counts: models 21, API 23, hook 42, workspace 36, test 23.

## Delivered

The controller assigns source UUIDs once, registers in 100-source chunks,
seals before four-wide accepted-source uploads, reports terminal Storage SDK
failures, and stores only batch/source/file metadata for reselect-and-match.
Remote Config sets `seriph_user_id`, fetches/activates, and gates the durable
path; unavailable or disabled configurations use the current resumable hook.
The upload-progress key is `sourceId`, and ImportWorkspace remains dynamically
loaded by its unchanged route boundary.

Concern: the API emulator checkpoint was not run here; browser Firebase Remote
Config and Storage require the configured authenticated/emulator environment.
The recovery metadata deliberately does not claim byte-offset resume.

Paths: `models/import-batch.models.ts`, `lib/imports/importBatchApi.ts`,
`lib/hooks/useDurableBatchUpload.ts`, `components/import/ImportWorkspace.tsx`,
and `tests/durableBatchUpload.test.ts`.

## Luna-high follow-up

### RED

Command: `npm test -- tests/durableBatchUpload.test.ts`

Result: exit 1 with four expected review-gap failures: no source-ID progress
callback, and missing `prepareDurableSources`, `readDurableEnabled`, and
`uploadWithFallback` exports. The recovery test therefore could not reuse the
persisted batch/session identity before this change.

### GREEN

- `npm test -- tests/durableBatchUpload.test.ts` — 5 focused tests passed.
- `npm test -- tests/durableBatchUpload.test.ts tests/importRouteBoundary.test.ts` — 8 tests passed.
- `npm run typecheck` — passed.

The recovered path now resumes a fully reselected matching session using its
persisted `batchId` and idempotency key, without issuing create/register/seal.
Progress is local hook state keyed by `sourceId` and is rendered in the Import
Workspace overlay. Remote Config errors fail closed, and disabled/setup-failed
durable uploads invoke the legacy hook. Recovery continues to store metadata
only and never claims byte-offset continuation.
