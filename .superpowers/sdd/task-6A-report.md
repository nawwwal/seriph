# Task 6A report

## Status

Completed in isolated worktree `/Users/adi/projects/seriph-task-6a` on branch
`codex/task-6a-config`.

Commit: `bf1758d feat: configure durable import limits`

## Files

- Modified `functions/src/config/rcKeyNames.ts`
- Modified `functions/src/config/rcDefaults.ts`
- Created `functions/src/imports/config/importConfig.ts`
- Created `functions/tests/imports/importConfig.test.ts`

No unrelated dirty files from the main worktree were modified or staged. This
report is intentionally untracked because the requested commit was limited to
the four files named in the brief.

## TDD evidence

The focused test was added before production code. The first invocation exposed
the fresh-worktree dependency prerequisite, so dependencies were installed from
the existing Functions lockfile without changing any manifest. The rerun then
produced the expected RED failure because the typed accessor module did not yet
exist.

### Initial environment prerequisite

```text
> test
> vitest run tests/imports/importConfig.test.ts

sh: vitest: command not found
```

### RED

Command:

```text
npm test --prefix functions -- tests/imports/importConfig.test.ts
```

Exact output:

```text
> test
> vitest run tests/imports/importConfig.test.ts


 RUN  v4.1.9 /Users/adi/projects/seriph-task-6a/functions

 ❯ tests/imports/importConfig.test.ts (0 test)

 Failed Suites 1

 FAIL  tests/imports/importConfig.test.ts [ tests/imports/importConfig.test.ts ]
Error: Cannot find module '../../src/imports/config/importConfig' imported from /Users/adi/projects/seriph-task-6a/functions/tests/imports/importConfig.test.ts
 ❯ tests/imports/importConfig.test.ts:2:1
      1| import { describe, expect, it } from "vitest";
      2| import { getImportConfig } from "../../src/imports/config/importConfig…
       | ^
      3|
      4| describe("import configuration", () => {

 Test Files  1 failed (1)
      Tests  no tests
   Start at  16:53:59
   Duration  146ms (transform 16ms, setup 0ms, import 0ms, tests 0ms, environment 0ms)
```

### GREEN

Command:

```text
npm test --prefix functions -- tests/imports/importConfig.test.ts && npm run build --prefix functions
```

Exact output:

```text
> test
> vitest run tests/imports/importConfig.test.ts


 RUN  v4.1.9 /Users/adi/projects/seriph-task-6a/functions


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  16:56:35
   Duration  417ms (transform 27ms, setup 0ms, import 278ms, tests 2ms, environment 0ms)


> build
> tsc
```

## Contract and self-review

- Registered the rollout flag, all source/archive limits, and retry schedule in
  the canonical Remote Config key/default registries.
- `getImportConfig` uses the cached accessor by default and accepts a reader
  injection for deterministic tests.
- Each numeric value rejects non-finite and negative input, and cannot exceed
  its Remote Config default safety ceiling. Retry input must contain three valid
  non-negative numbers and is capped element by element.
- The returned object and retry tuple are frozen. The test verifies exact
  defaults, oversized values, non-finite input, and both immutability surfaces.
- Independent checker review covered correctness, readability, architecture,
  security, performance, scope, and `git diff --check`; it found no findings.
- `npm run lint:lines` passed. Non-empty line counts: keys 63, defaults 64,
  contract 64, test 36.

## Concern

The local runtime is Node 25 while Functions declares Node 22, so `npm ci`
emitted its existing engine warning. The focused test and Functions TypeScript
build passed; no package files were changed.

## Follow-up: checker findings resolved

Commit: `cb24d17 fix: harden durable import config parsing`

Only `functions/src/imports/config/importConfig.ts` and
`functions/tests/imports/importConfig.test.ts` were committed in this follow-up.
The report remains intentionally untracked.

### RED

The direct regression cases were added before production parsing changed.

```text
> test
> vitest run tests/imports/importConfig.test.ts


 RUN  v4.1.9 /Users/adi/projects/seriph-task-6a/functions

 ❯ tests/imports/importConfig.test.ts (10 tests | 5 failed) 7ms
     × uses safe limit defaults for blank numeric values 3ms
     × uses safe limit defaults for whitespace numeric values 0ms
     × uses safe limit defaults for non-integer numeric values 0ms
     × uses safe retry defaults for a blank tuple element 0ms
     × uses safe retry defaults for a non-integer tuple element 0ms

 Failed Tests 5

 FAIL  tests/imports/importConfig.test.ts > import configuration > uses safe limit defaults for blank numeric values
 FAIL  tests/imports/importConfig.test.ts > import configuration > uses safe limit defaults for whitespace numeric values
AssertionError: expected { enabled: false, …(10) } to match object { sourceTimeoutMinutes: 1440, …(8) }
(2 matching properties omitted from actual)

- Expected
+ Received

  {
-   "archiveMaxCompressionRatio": 100,
-   "archiveMaxDepth": 4,
-   "archiveMaxEntries": 10000,
-   "archiveMaxEntryBytes": 268435456,
-   "archiveMaxExpandedBatchBytes": 2147483648,
-   "archiveMaxPathBytes": 1024,
-   "inlineZipBytes": 157286400,
-   "maxSourceBytes": 536870912,
-   "sourceTimeoutMinutes": 1440,
+   "archiveMaxCompressionRatio": 0,
+   "archiveMaxDepth": 0,
+   "archiveMaxEntries": 0,
+   "archiveMaxEntryBytes": 0,
+   "archiveMaxExpandedBatchBytes": 0,
+   "archiveMaxPathBytes": 0,
+   "inlineZipBytes": 0,
+   "maxSourceBytes": 0,
+   "sourceTimeoutMinutes": 0,
  }

 FAIL  tests/imports/importConfig.test.ts > import configuration > uses safe limit defaults for non-integer numeric values
AssertionError: expected { enabled: false, …(10) } to match object { sourceTimeoutMinutes: 1440, …(8) }
(2 matching properties omitted from actual)

- Expected
+ Received

  {
-   "archiveMaxCompressionRatio": 100,
-   "archiveMaxDepth": 4,
-   "archiveMaxEntries": 10000,
-   "archiveMaxEntryBytes": 268435456,
-   "archiveMaxExpandedBatchBytes": 2147483648,
-   "archiveMaxPathBytes": 1024,
-   "inlineZipBytes": 157286400,
-   "maxSourceBytes": 536870912,
-   "sourceTimeoutMinutes": 1440,
+   "archiveMaxCompressionRatio": 1.5,
+   "archiveMaxDepth": 1.5,
+   "archiveMaxEntries": 1.5,
+   "archiveMaxEntryBytes": 1.5,
+   "archiveMaxExpandedBatchBytes": 1.5,
+   "archiveMaxPathBytes": 1.5,
+   "inlineZipBytes": 1.5,
+   "maxSourceBytes": 1.5,
+   "sourceTimeoutMinutes": 1.5,
  }

 FAIL  tests/imports/importConfig.test.ts > import configuration > uses safe retry defaults for a blank tuple element
AssertionError: expected [ 300, +0, 7200 ] to deeply equal [ 300, 1800, 7200 ]

- Expected
+ Received

  [
    300,
-   1800,
+   0,
    7200,
  ]

 FAIL  tests/imports/importConfig.test.ts > import configuration > uses safe retry defaults for a non-integer tuple element
AssertionError: expected [ 300, 1800, 1.5 ] to deeply equal [ 300, 1800, 7200 ]

- Expected
+ Received

  [
    300,
    1800,
-   7200,
+   1.5,
  ]

 Test Files  1 failed (1)
      Tests  5 failed | 5 passed (10)
   Start at  17:02:04
   Duration  423ms (transform 28ms, setup 0ms, import 313ms, tests 7ms, environment 0ms)
```

### GREEN

Command:

```text
npm test --prefix functions -- tests/imports/importConfig.test.ts && npm run build --prefix functions && npm run lint:lines
```

Exact output:

```text
> test
> vitest run tests/imports/importConfig.test.ts


 RUN  v4.1.9 /Users/adi/projects/seriph-task-6a/functions


 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  17:02:49
   Duration  355ms (transform 22ms, setup 0ms, import 261ms, tests 2ms, environment 0ms)


> build
> tsc


> seriph@0.2.0 lint:lines
> node scripts/check-line-count.mjs

functions/src/imports/config/importConfig.ts: 75 non-empty lines
functions/tests/imports/importConfig.test.ts: 64 non-empty lines
```

### Follow-up self-review

- `nonNegativeInteger` trims input before conversion and accepts only finite,
  non-negative integers, so blank, whitespace-only, fractional, negative, and
  non-finite values all take the existing safe fallback path.
- Retry tuples use the same parser and are rejected atomically if their length
  is not exactly three or any element is malformed; a malformed remote value
  cannot partially lower the retry schedule.
- The direct test matrix covers blank, whitespace, negative, non-finite,
  non-integer, malformed tuple, invalid element, blank element, and fractional
  tuple element. Oversized-value caps remain covered by the original test.
- Focused checker review, `git diff --check`, Functions build, and line lint
  found no remaining findings. Both changed source files remain under 100
  non-empty lines.
