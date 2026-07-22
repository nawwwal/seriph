# Seriph Durable Batch Import Pipeline Tasks

Canonical details, interfaces, code snippets, dependency graph, and commands: [implementation plan](../docs/superpowers/plans/2026-07-18-seriph-durable-import-pipeline.md).

## Phase 0: Current production recovery

- [ ] Task 1: Isolate poison families during enrichment submission.
  - Acceptance: invalid/render-failed families become independent rejected records while valid families still submit.
  - Verify: `npm test --prefix functions -- tests/enrichment/preflight.test.ts tests/enrichment/submitIsolation.test.ts && npm run build --prefix functions`
  - Files: `functions/src/enrichment/preflight.ts`, `functions/src/ingest/batch/submit.ts`, two focused tests.
- [ ] Task 2: Build the dry-run production reconciler.
  - Acceptance: malformed family, stale alias, stuck ingest, and requeue actions are planned idempotently; writes require `--apply`.
  - Verify: focused test, Functions build, and JSON dry run from the canonical plan.
  - Files: two script modules, one test, `functions/package.json`.
- [ ] Checkpoint R: Review recovery dry-run evidence before any production apply.

## Phase 1: Contracts, persistence, and tasks

- [ ] Task 3: Define import records and batch-outcome reduction.
  - Acceptance: every approved state is a closed union and outcome precedence passes table tests.
  - Verify: focused outcome test and line-count lint.
  - Files: batch/item contracts, reducer, test.
- [ ] Task 4: Add owner-scoped import repositories.
  - Acceptance: repeated registrations do not double-count and invalid transitions return conflicts.
  - Verify: repository test and Functions build.
  - Files: path, batch, source stores and test.
- [ ] Task 5: Secure batch reads and deploy indexes.
  - Acceptance: owner reads succeed, cross-owner reads/client writes fail, required queries are indexed.
  - Verify: Firestore emulator rules test and Firebase index parse.
  - Files: rules, indexes, root dependency files, rules test.
- [ ] Task 6: Implement deterministic Cloud Tasks enqueue and leases.
  - Acceptance: stable task names, already-exists convergence, active lease exclusion, and expired lease recovery.
  - Verify: task queue test and Functions build.
  - Files: Functions dependency files, enqueue/lease modules, test.
- [ ] Task 6A: Register one typed import configuration contract.
  - Acceptance: rollout, source/archive limits, and enrichment retries have exact safe defaults and bounded Remote Config parsing.
  - Verify: import config test and Functions build.
  - Files: RC keys/defaults, typed import config, test.
- [ ] Task 7: Add the authenticated task dispatcher.
  - Acceptance: private IAM/OIDC invocation is configured, missing metadata/unknown tasks fail, and allowlisted tasks dispatch.
  - Verify: task test and Functions build.
  - Files: dispatcher, trigger, options/index exports, task test.

## Phase 2: Batch API and browser upload

- [ ] Task 8: Create/list/read batches through authenticated APIs.
  - Acceptance: create is idempotent, owner-scoped list/detail pagination is bounded, and state conflicts use typed HTTP 409 errors.
  - Verify: import batch API test and root typecheck.
  - Files: command/query helpers, two routes, test.
- [ ] Task 9: Register/seal sources and persist upload failures.
  - Acceptance: every selected source has a durable record, seal validates counts, and terminal client failures persist.
  - Verify: import source API test and typecheck.
  - Files: source command helper, three routes, test.
- [ ] Task 10: Replace registration-only upload with a durable browser controller.
  - Acceptance: Remote Config selects durable versus legacy upload, create/register/seal/upload/failure order is deterministic, and reload metadata reuses the same batch/source IDs.
  - Verify: durable upload and import route tests plus typecheck.
  - Files: browser models/API/hook, Import Workspace, test.
- [ ] Checkpoint A: Verify two-source partial upload and replay in emulators.

## Phase 3: Discovery and planning

- [ ] Task 11: Confirm finalized objects and time out abandoned uploads.
  - Acceptance: object generation confirms once; mismatched paths reject; stale registrations terminate.
  - Verify: source lifecycle test and Functions build.
  - Files: finalize/timeout handlers, import trigger/options, test.
- [ ] Task 12: Detect content, classify roles, and persist inventory.
  - Acceptance: signatures beat extensions; every item has hash/provenance/role/action/reason; unknowns review.
  - Verify: inventory and parser tests.
  - Files: signature, role, inventory, item store, test.
- [ ] Task 13: Expand small/nested ZIPs under one safety policy.
  - Acceptance: limits and unsafe paths quarantine; child item/task creation is replay-safe.
  - Verify: ZIP, task-redelivery tests, Functions build.
  - Files: archive policy/path/discovery, dispatcher, test.
- [ ] Task 14: Route oversized ZIPs through Cloud Run.
  - Acceptance: private IAM/OIDC worker streams eligible archives without full buffering, shares inventory policy, and setup covers queue/IAM/service APIs idempotently.
  - Verify: archive worker test, local Docker build, shell syntax, and setup dry run.
  - Files: server/handler, Dockerfile, setup script, test.
- [ ] Task 15: Centralize identity, technology, and logical face keys.
  - Acceptance: preferred/WWS/legacy/PS precedence and axis-based Variable detection pass fixtures.
  - Verify: new identity plus existing canonical/parser suites.
  - Files: identity/technology/logical-face modules, canonical export, test.
- [ ] Task 16: Claim identical bytes and validate immutable plans.
  - Acceptance: exact duplicates collapse; formats/versions survive; conflicts review; plan versions never mutate.
  - Verify: import-plan and task-redelivery tests.
  - Files: claim store, plan builder/validator/store, test.
- [ ] Checkpoint B: Replay mixed/malicious fixture and compare identical plan JSON.

## Phase 4: Catalogue application

- [ ] Task 17: Add logical-face asset variants and compatibility projection.
  - Acceptance: `assets[]` retains alternates while old readers receive the preferred asset fields.
  - Verify: Functions face-assets and root adapter tests plus both typechecks.
  - Files: catalog assets/buildFace/browser adapter and two tests.
- [ ] Task 18: Apply one complete family plan transactionally.
  - Acceptance: one family version/mutation per plan, no partial family, replay no-op, stale precondition replans.
  - Verify: apply-plan and family-store tests.
  - Files: artifact/apply/mutation modules, dispatcher, test.
- [ ] Task 19: Reconcile batches, coalesce shelf invalidation, and guard rollback.
  - Acceptance: counters derive consistently, shelf revision changes once, rollback cannot overwrite newer edits.
  - Verify: batch-reconcile and catalogue-summary tests in both packages.
  - Files: reconcile/rollback modules, catalog summary, dispatcher, test.
- [ ] Checkpoint C: Import mixed fixture with AI disabled and replay every event.

## Phase 5: Per-family enrichment

- [ ] Task 20: Create versioned enrichment jobs and collect safely.
  - Acceptance: family commit creates one version-keyed job; disabled/invalid jobs terminate independently.
  - Verify: collector and apply-plan tests.
  - Files: job types/store/collector, apply module, test.
- [ ] Task 21: Submit provider batches with complete expected sets.
  - Acceptance: every provider row maps to one expected job and render failures are explicit rejections.
  - Verify: provider-submit test and Functions build.
  - Files: input/expected modules, submit/key modules, test.
- [ ] Task 22: Reconcile outputs, retry per family, and atomically swap search data.
  - Acceptance: missing/malformed/duplicate/stale rows classify; retries bound; prior valid enrichment survives failure.
  - Verify: output reconciliation, enrichment update, search document tests, Functions build.
  - Files: reconciler/retry modules, poll/output modules, test.
- [ ] Checkpoint D: Run valid, poison, stale, and disabled AI canaries.

## Phase 6: Real-time import tray

- [ ] Task 23: Subscribe to recent batches and lazy child status.
  - Acceptance: listener is normal path, API is fallback, terminal history stays, applied-family changes invalidate catalogue.
  - Verify: feed, completion, and app-frame tests plus typecheck.
  - Files: mapper, two hooks, UploadContext, test.
- [ ] Task 24: Render one compact global import tray.
  - Acceptance: one tray shows the current phase and progress; failed batches alone expose concise review details.
  - Verify: import-surface tests and a real-browser drop/import journey.
  - Files: global upload surface, tray, status mapper, test.
- [ ] Task 25: Add family/item drill-down and retry/cancel actions.
  - Acceptance: structured provenance/errors/actions render without private paths and nested controls are accessible.
  - Verify: detail/action and button-style tests plus typecheck.
  - Files: family/item/review components, action client, test.
- [ ] Task 26: Add retry/cancel APIs and reload recovery handoff.
  - Acceptance: only retryable failed targets queue; applied families remain; reselected bytes resume existing source IDs.
  - Verify: action, durable upload, and route-boundary tests plus typecheck.
  - Files: action command, two routes, durable upload hook, test.
- [ ] Checkpoint E: Verify live drop-to-catalogue-to-AI journey in a real browser.

## Phase 7: Migration and rollout

- [ ] Task 27: Import old-ingest history into the durable tree.
  - Acceptance: synthetic history never invents inventory; CLI is idempotent and dry-run-first; no runtime dual-read, legacy merge, flags, or fallback remains.
  - Verify: migration planner test, Functions build, JSON dry run.
  - Files: migration script/planner/test, Functions package script.
- [ ] Task 28: Complete API docs, canary, observability, lifecycle, and staged cutover.
  - Acceptance: OpenAPI covers all routes; replay canary is stable; setup/deploy/runbook/metrics/rollback gates are executable.
  - Verify: every root/Functions/emulator/build gate and staged infrastructure inspections in the canonical plan.
  - Files: OpenAPI/test, canary, lifecycle JSON, deployment runbook.
- [ ] Checkpoint F: Approve production completion only after canary, recovery, migration, and observation evidence.
