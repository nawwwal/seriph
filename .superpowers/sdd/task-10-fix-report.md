# Task 10 lifecycle fix report

Status: complete

Workspace: `/Users/adi/projects/seriph-task-10`

Commit: `398ceb1 fix: close durable upload lifecycle gaps`

## RED evidence

Regression tests were added before implementation changes.

Command:

```text
npm test -- tests/durableBatchUpload.test.ts
```

Result: exit 1. The existing four capability tests passed, while three new
tests failed:

- owner-mismatched recovery incorrectly resumed instead of creating a batch;
- successful recovery had no clear operation, so a later identical upload could
  reuse it;
- durable create failure was swallowed and legacy upload was invoked instead of
  surfacing the durable error.

## GREEN evidence

- `npm test -- tests/durableBatchUpload.test.ts tests/importRouteBoundary.test.ts`
  — 2 files and 10 tests passed.
- `npm run typecheck` — passed.
- `npm run lint:lines` — passed.
- `git diff --check` — passed.
- staged `git diff --cached --check` — passed before commit.

## Changes

- `models/import-batch.models.ts`
  - Added owner-scoped recovery metadata.
  - Added explicit durable phases and structured success/failure results.
  - Added an optional persisted-recovery clear operation.
- `lib/hooks/useDurableBatchUpload.ts`
  - Reuses recovery only when the authenticated owner and reselected source
    metadata match.
  - Clears recovery only after every accepted source succeeds; terminal upload
    failures remain persisted through `fail`.
  - Marks mutation before create/register/seal and returns the phase on errors.
  - Allows legacy fallback only for `mutationStarted: false` setup failures.
  - Keeps source-ID progress, 100-source registration chunks, concurrency 4,
    rejected-source skipping, metadata-only reselect recovery, and no byte
    offset resume.
- `tests/durableBatchUpload.test.ts`
  - Added owner isolation and post-success reset coverage.
  - Added post-create failure coverage proving legacy is not invoked.
  - Strengthened recovery coverage to assert no create/register/seal on resume.

`lib/imports/importBatchApi.ts` and `components/import/ImportWorkspace.tsx` were
reviewed and left unchanged; the existing API contract and dynamic import route
boundary remain intact.

## Self-review

- Recovery is scoped twice: session reads filter by `user.uid`, and the
  orchestration independently rejects an owner mismatch.
- A successful upload removes the session record; a source failure does not.
- The mutation boundary is set before each durable mutation phase, so create,
  register, seal, resume, and upload errors cannot fall through to legacy.
- Setup-disabled, unsupported, token/setup, and other pre-mutation failures
  still produce a setup result that invokes the compatibility upload.
- Existing chunking, concurrency, rejected-source, failure persistence,
  sourceId-progress, resume, metadata-only recovery, and route-boundary tests
  remain green.

Concern: the Firebase API/Storage/Remote Config emulator checkpoint was not run
in this isolated review environment. Verification is limited to the focused
unit/integration tests, route-boundary test, typecheck, lint, and git checks.

The report is intentionally untracked and was not included in the commit.

## Recovery bijection correction

Date: 2026-07-18

### RED evidence

Added regressions to `tests/durableBatchUpload.test.ts` before changing the
controller. The command below failed with two failures:

```text
npm test -- tests/durableBatchUpload.test.ts
1 file failed; 9 tests total; 2 failed
- duplicate reselected metadata received ['s1', 's1'] instead of ['s1', 's2']
- recovery with duplicate source IDs resumed instead of creating a batch
```

### GREEN implementation

- Metadata recovery now consumes each persisted source row once, so equal
  filename/path/size metadata maps to distinct source IDs.
- Recovery reuse requires exact source cardinality, unique persisted and
  current source IDs, matching source-ID sets, and exact metadata by source ID.
- A failed bijection produces fresh source IDs and therefore starts a new
  batch; recovery is not resumed or cleared as that old batch.

### Verification

```text
npm test -- tests/durableBatchUpload.test.ts tests/importRouteBoundary.test.ts
2 files and 12 tests passed
npm run typecheck
passed
npm run lint:lines
passed
git diff --check
passed
```
