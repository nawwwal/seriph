# Task 3 report: durable import contracts

## Scope

Implemented only the Task 3 contracts, pure outcome reducer, and focused test:

- `functions/src/imports/contracts/batch.ts`
- `functions/src/imports/contracts/item.ts`
- `functions/src/imports/state/deriveBatchOutcome.ts`
- `functions/tests/imports/deriveBatchOutcome.test.ts`

This report is intentionally left uncommitted because the brief limits the commit to the four paths above.

## RED evidence

The first focused command in the new worktree could not start because dependencies were absent:

```text
> test
> vitest run tests/imports/deriveBatchOutcome.test.ts

sh: vitest: command not found
```

After `npm ci --prefix functions`, the same required RED command failed for the expected missing reducer module:

```text
> test
> vitest run tests/imports/deriveBatchOutcome.test.ts

 RUN  v4.1.9 /Users/adi/projects/seriph-task-3/functions

 FAIL  tests/imports/deriveBatchOutcome.test.ts [ tests/imports/deriveBatchOutcome.test.ts ]
Error: Cannot find module '../../src/imports/state/deriveBatchOutcome' imported from /Users/adi/projects/seriph-task-3/functions/tests/imports/deriveBatchOutcome.test.ts

 Test Files  1 failed (1)
      Tests  no tests
```

## GREEN evidence

Command: `npm test --prefix functions -- tests/imports/deriveBatchOutcome.test.ts && npm run lint:lines`

```text
> test
> vitest run tests/imports/deriveBatchOutcome.test.ts

 RUN  v4.1.9 /Users/adi/projects/seriph-task-3/functions

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  16:54:25
   Duration  108ms (transform 12ms, setup 0ms, import 17ms, tests 1ms, environment 0ms)

> seriph@0.2.0 lint:lines
> node scripts/check-line-count.mjs
```

Additional source type check: `npm run lint --prefix functions` exited 0.

## Implementation review

- All source state unions are closed and Firebase-free.
- `ImportError`, explicit phase records, source/item persistence records, archive lineage, role/action/reason unions, and aggregate/terminal counters are durable plain TypeScript data.
- Reducer precedence is `active`, `canceled`, `needs_review`, `partial`, `failed`, then `succeeded`, matching the specification and table tests.
- Non-empty source-line counts: `batch.ts` 74, `item.ts` 44, `deriveBatchOutcome.ts` 11.
- `git diff --check` exited 0.
- No stores, APIs, queues, Firebase types, or unrelated worktree files were modified or staged.

## Concerns

- The local runtime is Node 25.9.0 while `functions/package.json` declares Node 22; the focused test, line-count lint, and TypeScript check all completed successfully, but `npm ci` emitted the engine warning.

## Checker follow-up: owner linkage and precedence coverage

### Corrections

- Added required `ownerId` and `batchId` fields to `ImportSource`, matching `users/{uid}/importBatches/{batchId}/sources/{sourceId}`.
- Added required `ownerId` and `batchId` fields to `ImportItem`; its existing `sourceId` retains the immediate source relationship for `users/{uid}/importBatches/{batchId}/items/{itemId}` and source/archive provenance.
- Added named competing-condition tests proving active over canceled, canceled over review, review over partial, and partial over failed.

### Honest TDD evidence

The four new precedence tests were added before changing the contracts and correctly passed immediately because `deriveBatchOutcome` already implemented the specified precedence. This was GREEN coverage expansion, not a RED/GREEN reducer fix. The owner/parent linkage correction is a pure TypeScript contract change, verified by the source TypeScript check.

Initial coverage-only run:

```text
> test
> vitest run tests/imports/deriveBatchOutcome.test.ts

 RUN  v4.1.9 /Users/adi/projects/seriph-task-3/functions

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

Final verification command: `npm test --prefix functions -- tests/imports/deriveBatchOutcome.test.ts && npm run lint --prefix functions && npm run lint:lines`

```text
> test
> vitest run tests/imports/deriveBatchOutcome.test.ts

 RUN  v4.1.9 /Users/adi/projects/seriph-task-3/functions

 Test Files  1 passed (1)
      Tests  9 passed (9)

> lint
> tsc --noEmit

> seriph@0.2.0 lint:lines
> node scripts/check-line-count.mjs
```

The four precedence scenarios remain present; the final count is 9 because the pre-existing duplicate partial case was replaced by the explicitly named competing-condition case. Source files remain below the 100 non-empty-line limit: `batch.ts` 76, `item.ts` 46, and `deriveBatchOutcome.ts` 11. `git diff --check` exited 0.
