# Task 1 report: isolate poison families during enrichment submission

## Scope and workspace

- Worktree: `/Users/adi/projects/seriph-task-1`
- Branch: `codex/task-1-enrichment-isolation`
- Only the four brief-named source/test files are staged and committed.
- The report is intentionally untracked and excluded from the commit.

## TDD evidence

### RED

Command:

```sh
npm test --prefix functions -- tests/enrichment/preflight.test.ts tests/enrichment/submitIsolation.test.ts
```

Exact output:

```text
> test
> vitest run tests/enrichment/preflight.test.ts tests/enrichment/submitIsolation.test.ts

 RUN  v4.1.9 /Users/adi/projects/seriph/functions

 ❯ tests/enrichment/preflight.test.ts (0 test)
 ❯ tests/enrichment/submitIsolation.test.ts (1 test | 1 failed) 2ms
     × submits valid families when one selected family is malformed 1ms

 FAIL  tests/enrichment/preflight.test.ts [ tests/enrichment/preflight.test.ts ]
Error: Cannot find module '../../src/enrichment/preflight' imported from /Users/adi/projects/seriph/functions/tests/enrichment/preflight.test.ts
 ❯ tests/enrichment/preflight.test.ts:2:1
      1| import { describe, expect, it } from "vitest";
      2| import { preflightFamily } from "../../src/enrichment/preflight";
       | ^
      3| import type { FontFamilyDoc } from "../../src/models/catalog.models";
      4|

 FAIL  tests/enrichment/submitIsolation.test.ts > buildSubmissionCandidates > submits valid families when one selected family is malformed
TypeError: buildSubmissionCandidates is not a function
 ❯ tests/enrichment/submitIsolation.test.ts:17:26
     15|     };
     16|
     17|     const result = await buildSubmissionCandidates([malformedFamily, validFamily], renderFixture);
       |                          ^
     18|
     19|     expect(result.accepted.map((entry) => entry.family.id)).toEqual([validFamily.id]);

 Test Files  2 failed (2)
      Tests  1 failed (1)
   Start at  16:54:02
   Duration  1.04s (transform 74ms, setup 0ms, import 975ms, tests 2ms, environment 0ms)
```

The failure was expected: neither the preflight module nor the isolated candidate builder existed.

### GREEN

Command:

```sh
npm test --prefix functions -- tests/enrichment/preflight.test.ts tests/enrichment/submitIsolation.test.ts && npm run build --prefix functions
```

Exact output:

```text
> test
> vitest run tests/enrichment/preflight.test.ts tests/enrichment/submitIsolation.test.ts

 RUN  v4.1.9 /Users/adi/projects/seriph-task-1/functions

 Test Files  2 passed (2)
      Tests  2 passed (2)
   Start at  16:58:29
   Duration  1.27s (transform 74ms, setup 0ms, import 1.18s, tests 3ms, environment 0ms)

> build
> tsc
```

## Delivered behavior

- `preflightFamily` rejects aliases and malformed ready families with explicit codes and reasons.
- Candidate construction validates each family before rendering, catches per-family specimen exceptions, and keeps valid candidates.
- Rejected records persist their code, reasons, original message, and stack; accepted families alone are submitted and marked `enriching`.
- Scheduler output and return data include `selected`, `submitted`, and `rejected` counts.

## Files

- `functions/src/enrichment/preflight.ts`
- `functions/src/ingest/batch/submit.ts`
- `functions/tests/enrichment/preflight.test.ts`
- `functions/tests/enrichment/submitIsolation.test.ts`

## Self-review

- `git diff --check` passed.
- `preflight.ts` has 33 non-empty lines; `submit.ts` has 99, within Seriph's 100-line limit.
- The production query still selects only `ready` and not-currently-enriched families; preflight now owns canonical/alias rejection.
- The parent checkout’s unrelated dirty paths were not staged or modified after the worktree correction.

## Concerns

- None for this task. `npm ci` in the isolated worktree reported existing dependency deprecation/audit warnings and a Node 25 versus Node 22 engine warning; neither changed tracked files or affected the focused tests/build.

## Follow-up: early-return scheduler counts

The disabled and no-ready-family scheduler logs now include the same exact zero counts as their return values: `selected 0, submitted 0, rejected 0`.

### Follow-up RED

Command:

```sh
npm test --prefix functions -- tests/enrichment/preflight.test.ts tests/enrichment/submitIsolation.test.ts
```

Exact output:

```text
RUN  v4.1.9 /Users/adi/projects/seriph-task-1/functions

❯ tests/enrichment/submitIsolation.test.ts (3 tests | 2 failed) 10ms
  × logs zero submission counts when enrichment is disabled 3ms
  × logs zero submission counts when enrichment has no ready families 4ms

FAIL  tests/enrichment/submitIsolation.test.ts > buildSubmissionCandidates > logs zero submission counts when enrichment is disabled
AssertionError: expected "vi.fn()" to be called with arguments: [ Array(1) ]
Received:
- "[batch] enrichment disabled (kill-switch); skipping submit. selected 0, submitted 0, rejected 0."
+ "[batch] enrichment disabled (kill-switch); skipping submit."

FAIL  tests/enrichment/submitIsolation.test.ts > buildSubmissionCandidates > logs zero submission counts when enrichment has no ready families
AssertionError: expected "vi.fn()" to be called with arguments: [ Array(1) ]
Received:
- "[batch] no pending families to enrich. selected 0, submitted 0, rejected 0."
+ "[batch] no pending families to enrich."

Test Files  1 failed | 1 passed (2)
     Tests  2 failed | 2 passed (4)
```

### Follow-up GREEN

Command:

```sh
npm test --prefix functions -- tests/enrichment/preflight.test.ts tests/enrichment/submitIsolation.test.ts && npm run build --prefix functions
```

Exact output:

```text
> test
> vitest run tests/enrichment/preflight.test.ts tests/enrichment/submitIsolation.test.ts

RUN  v4.1.9 /Users/adi/projects/seriph-task-1/functions

Test Files  2 passed (2)
     Tests  4 passed (4)
Start at  17:04:51
Duration  885ms (transform 176ms, setup 0ms, import 523ms, tests 27ms, environment 0ms)

> build
> tsc
```

### Follow-up self-review

- Regression coverage asserts both disabled and no-ready-family log messages and return counts.
- `submit.ts` remains at 99 non-empty lines, under the 100-line hard cap.
- The follow-up commit stages only `functions/src/ingest/batch/submit.ts` and `functions/tests/enrichment/submitIsolation.test.ts`; this report remains untracked.
