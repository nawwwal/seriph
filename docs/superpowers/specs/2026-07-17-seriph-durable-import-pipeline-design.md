# Seriph Durable Batch Import Pipeline Design

**Date:** 2026-07-17

**Status:** Approved for implementation planning
**Chosen approach:** Durable Batch Workflow

## Summary

Seriph will treat every dropped folder, ZIP, or loose-file selection as one durable import batch. The batch first discovers, extracts, parses, classifies, deduplicates, and groups every item into an immutable plan. After validation, Seriph automatically applies every clean family group to the catalogue. Ambiguous or unsafe items enter review without blocking valid families.

The catalogue remains store-first: deterministic metadata and usable font assets appear before AI enrichment. AI enrichment is a separate, versioned, per-family workflow whose status is reported in real time and whose failures never make a deterministic family unusable.

The user-facing hierarchy is:

1. Import batch
2. Planned/catalogued families
3. Source and extracted files
4. Review items and failure details

This replaces the current file-first model, where archive containers, extracted fonts, family writes, and AI jobs do not share a reliable completion contract.

## Goals

- Import folders, loose files, ZIPs, and nested ZIPs containing one or many font families.
- Preserve a durable, explainable inventory from source path through catalogue destination.
- Resolve family and face identity from font contents before filenames or paths.
- Apply clean imports automatically while isolating ambiguous items for review.
- Make retries, trigger redelivery, and worker crashes idempotent.
- Show real-time upload, discovery, catalogue, AI, completion, review, and failure status.
- Keep valid families usable when AI is delayed, disabled, or failed.
- Preserve distinct formats and meaningful versions without overwriting logical faces.
- Support dry-run reconciliation, post-apply audit, and safe rollback.

## Non-goals

- Copying the local `Family/OTF/TTF/Variable/...` filesystem layout into Cloud Storage.
- Blocking every import on human approval.
- Making AI enrichment synchronous with catalogue creation.
- Supporting arbitrary archive formats in the first release. ZIP is supported; other archives enter review.
- Replacing the existing Seriph visual language.
- Replacing Firebase, Firestore, Cloud Storage, or the existing CDN contract.

## Implementation assumptions

- The rollout is additive until the new path passes a production canary; existing catalogue readers and old ingest history remain readable during migration.
- Clean family plans apply automatically after validation. Human review is reserved for ambiguous identity, unsafe archives, conflicting non-identical assets, and explicitly quarantined items.
- Cloud Functions, Cloud Tasks, and the oversized-archive Cloud Run service run in `asia-southeast1`; Vertex batch analysis may continue using its provider-supported global location.
- The current Firebase project `seriph`, private default Storage bucket, public `seriph-fonts` bucket, Firestore database, and Vercel application remain the deployment targets.
- The current Seriph visual language remains fixed. Upload Center may change information architecture, but not introduce a parallel component or color system.

## Tech stack and commands

The implementation stays on Next.js 16, React 19, TypeScript 6, Firebase Web/Admin SDKs, Firestore, Cloud Storage, Cloud Functions gen2 on Node 22, Cloud Tasks, one Node 22 Cloud Run archive service, Vertex batch analysis, `fontkit`, `opentype.js`, `unzipper`, `wawoff2`, Vitest, and Firebase emulators.

Run these commands from the repository root unless a command says otherwise:

```bash
npm run typecheck
npm run lint:lines
npm run lint:web
npm test
npm run build
npm run build --prefix functions
npm run lint:functions
npm test --prefix functions
firebase emulators:exec --only firestore,storage,functions "npm test && npm test --prefix functions"
git diff --check
```

Production setup and deploy commands are scripted and dry-run/inspect-first. The implementation plan must name the exact script and canary commands; agents must not improvise destructive production mutations from this document.

## Project structure and code style

- `functions/src/imports/` owns batch state, discovery, planning, task dispatch, catalogue application, mutation audit, and batch reconciliation.
- `functions/src/enrichment/` owns versioned per-family jobs and provider batch reconciliation. Provider-specific Vertex adapters stay below this boundary.
- `functions/src/triggers/` contains thin Cloud Function entrypoints only.
- `functions/src/scripts/` contains dry-run-first recovery and migration commands.
- `functions/tests/imports/` and `functions/tests/enrichment/` mirror those backend domains.
- `app/api/v1/import-batches/` exposes the owner-scoped HTTP fallback and command API.
- `lib/server/imports/` owns API validation, idempotency, authorization-adjacent ownership checks, and Firestore mutations used by Next.js routes.
- `models/import-batch.models.ts`, `lib/imports/`, `lib/hooks/`, `lib/contexts/`, and `components/upload/` own the browser contract, listeners, client progress overlay, and Upload Center hierarchy.
- `infra/import-pipeline/` owns idempotent GCP setup, queue configuration, Storage lifecycle policy, and archive-worker deployment inputs.
- `docs/openapi/seriph-api.yaml` remains the external API contract. `tasks/plan.md` points to the canonical implementation plan and `tasks/todo.md` tracks its reviewable tasks.

All source files must remain at or below 100 non-empty lines. Route and trigger files authenticate/validate then delegate. Domain functions use explicit discriminated results instead of throwing for expected workflow outcomes. For example:

```ts
export type ApplyFamilyResult =
  | { kind: "applied"; familyId: string; familyVersion: number; mutationId: string }
  | { kind: "already_applied"; familyId: string; familyVersion: number }
  | { kind: "replan_required"; expectedVersion: number; actualVersion: number }
  | { kind: "review"; reasonCode: string }
  | { kind: "failed"; retryable: boolean; errorCode: string };
```

Persistence modules own transactions and timestamps; pure planners do not write. Public API DTOs, Firestore persistence records, and UI view models remain separate so storage details do not leak into components.

## Implementation boundaries

- **Always:** use TDD for behavior changes; preserve owner scoping; validate untrusted JSON, archive paths, and font contents; use deterministic idempotency keys; run dry-run reconciliation before production mutation; keep deterministic families usable without AI; update OpenAPI and security rules with contract changes; preserve unrelated dirty-worktree changes.
- **Ask first:** changing canonical family IDs, deleting historical inventory, making source/design files public, increasing archive limits beyond the approved defaults, changing vector dimensions/models outside Remote Config, or advancing production rollout beyond the canary and staged percentages in the approved plan.
- **Never:** commit secrets or service-account keys; accept client-authored authoritative workflow state; deduplicate non-identical bytes; let an archive entry escape its staging prefix; apply stale AI output; delete prior valid enrichment before a replacement commits; perform destructive production repair without an explicit dry run and recorded counts.

## Open questions

No product or architecture question blocks planning. Build-time discoveries that would change the approved identity, storage, visibility, security, or rollout contracts must update this specification before implementation continues.

## Current-state findings

The current implementation has useful foundations: resumable intake uploads, recursive ZIP handling, deterministic parsing, canonical family identity, content hashes, immutable CDN paths, family-level AI enrichment, and a global Upload Center. The audit also found structural failures that require a workflow redesign rather than isolated patches.

- Archive traversal mutates catalogue-adjacent state while discovery is still in progress.
- Registered ZIP container ingests are not finalized through the same lifecycle as extracted fonts.
- Upload errors can leave registered records pending because the active upload path does not persist terminal client failures.
- The active-status API removes completed and failed records, so Upload Center cannot provide durable history despite having completion/error filters.
- A family can become visible and eligible for enrichment after its first face, before the rest of the batch arrives.
- Same-style, different-format or different-version files can overwrite one logical face.
- Deduplication queries prior ingest records and can race or treat failed pre-storage attempts as committed duplicates.
- AI submission is global and insufficiently isolated. A malformed family can abort the entire submit run.
- AI output does not reconcile the complete expected family set, allowing missing rows to remain stuck.
- The current deterministic and AI phases overload `analysisState`, producing inconsistent transitions.
- Live production has 211 `ready` families, of which 210 are structurally valid and one malformed `chap` document has no owner or faces. The malformed document can crash global AI submission. The submit scheduler has returned HTTP 500 every 30 minutes since at least 2026-07-10.
- Seventy-seven hidden alias documents remain in `enriching` from a historical partially applied job, and one current ingest remains nonterminal in `enriching`.

## Architecture decision

Use a durable Firestore batch manifest with idempotent stage workers. Storage finalization wakes workers but is not itself the business-state authority. Cloud Tasks supplies deterministic task names, bounded retries, and rate control. Small ZIPs are streamed within the ingestion worker limits; oversized archives are routed to a Cloud Run archive worker. Cloud Run is not the primary orchestration system.

The end-to-end flow is:

```text
register batch and sources
  -> resumable upload to private intake
  -> confirm source objects
  -> discover/extract/hash/classify every item
  -> seal and validate immutable plan version
  -> apply clean family groups transactionally
  -> publish catalogue families and assets
  -> enqueue versioned family enrichment jobs
  -> render specimen and run AI batch analysis
  -> embed and atomically publish enrichment/search data
  -> reconcile batch and retain history
```

## Durable data model

### Import batch

`users/{uid}/importBatches/{batchId}` is the source of truth for the user-visible operation.

It stores:

- `schemaVersion`
- `ownerId`
- `label` derived from the dropped folder, ZIP, or selection
- `sealed` and `expectedSourceCount`
- `planVersion`
- phase states for upload, discovery, planning, catalogue application, and enrichment
- derived outcome: `active | succeeded | partial | needs_review | failed | canceled`
- aggregate counters for sources, discovered items, fonts, families, duplicates, review items, warnings, and failures
- timestamps, last progress, and terminal summary

Batch phase summaries are server-owned. Client upload progress is merged into the UI but does not overwrite authoritative server state.

### Sources

`users/{uid}/importBatches/{batchId}/sources/{sourceId}` represents every browser-selected file.

It stores the original relative path, filename, declared size/type, storage path, upload confirmation, source role, retry count, timestamps, and terminal failure. `sourceId` is allocated once and reused for retries. The intake path is:

`intake/{uid}/{batchId}/{sourceId}/{sanitizedFilename}`

### Inventory items

`users/{uid}/importBatches/{batchId}/items/{itemId}` represents every source or extracted entry.

`itemId` is a deterministic hash of batch ID, source ID, normalized archive lineage, and entry path. It is distinct from `contentHash`, which is the full SHA-256 of the bytes.

Each item stores:

- source ID, original path, and complete source-archive lineage
- original filename, extension, size, CRC when available, and SHA-256
- content-detected container format and MIME type
- parsed OpenType naming, OS/2, PostScript, variation-axis, feature, and coverage metadata
- canonical family identity, logical face identity, style, technology, and confidence/reasoning codes
- role: `font | source | documentation | web | archive | junk | unresolved`
- planned action and reason
- destination family/face/asset keys when applicable
- item state, attempt count, structured error, and timestamps

Inventory records are retained as the durable migration/debug record even after raw intake objects expire.

### Planned families

`users/{uid}/importBatches/{batchId}/families/{familyPlanId}` contains one immutable family application unit for a plan version.

It stores the canonical identity, intended catalogue family ID, logical faces, asset variants, existing-family precondition, review flags, application idempotency key, applied family version, enrichment summary, and mutation result.

Clean family plans apply independently. A review item does not block unrelated clean families.

### Asset claims

`users/{uid}/assetClaims/{sha256}` is the authoritative byte-deduplication claim.

Claims are transactionally leased and committed. A failed or expired processing claim can be recovered; it is never treated as a completed duplicate. This removes query races against historical ingest rows.

### Enrichment jobs

Top-level `enrichmentJobs/{jobId}` documents remain admin-written and are keyed by:

`familyId + familyVersion + promptVersion + analysisModel + embeddingVersion`

The user-visible enrichment summary is mirrored onto the batch family plan and catalogue family. Raw job infrastructure remains admin-only.

## State contracts

### Source state

`registered -> uploading -> uploaded -> discovering -> discovered`

Terminal alternatives are `failed`, `canceled`, and `timed_out`. A source never remains pending indefinitely.

### Inventory item state

`discovered -> classified -> planned -> applied`

Terminal alternatives are `duplicate`, `review`, `discarded`, and `failed`.

### Plan state

`building -> validated -> applying -> applied`

Terminal alternatives are `partial` and `failed`. A validated plan version is immutable; changed discovery results create a new plan version.

### Enrichment state

`blocked -> queued -> rendering -> submitted -> analyzing -> embedding -> indexing -> complete`

Recoverable alternatives use `retrying`. Terminal alternatives are `failed` and `skipped_disabled`. AI state is never reused to represent deterministic parsing.

### Batch outcome

The batch outcome is derived from phase and child states:

- `succeeded`: all applicable families were catalogued and enrichment either completed or was explicitly `skipped_disabled`, with no review or terminal failures. An all-duplicate no-op import also succeeds.
- `partial`: at least one usable family was catalogued, but another source/item/family failed or enrichment exhausted its retries.
- `needs_review`: all clean work completed, but one or more unresolved items require a decision. Review takes precedence over `succeeded` but does not hide independently failed work.
- `failed`: no usable family was produced.
- `canceled`: remaining work was canceled; already committed families stay recorded.

If multiple terminal conditions apply, outcome precedence is `canceled`, `needs_review`, `partial`, `failed`, then `succeeded`; the terminal summary retains every contributing warning and failure. AI delays keep the batch `active`, but AI never delays catalogue visibility or usability.

## Registration and upload contract

The public API becomes batch-oriented:

- `POST /api/v1/import-batches` creates a batch.
- `POST /api/v1/import-batches/{batchId}/sources` registers source chunks.
- `POST /api/v1/import-batches/{batchId}/seal` declares registration complete and fixes `expectedSourceCount`.
- `POST /api/v1/import-batches/{batchId}/sources/{sourceId}/failure` records a terminal client upload failure or cancellation.
- `POST /api/v1/import-batches/{batchId}/actions/retry` retries a specific failed stage or family.
- `POST /api/v1/import-batches/{batchId}/actions/cancel` cancels work not yet committed.
- `GET /api/v1/import-batches/{batchId}` is the polling/recovery fallback.

The normal UI reads owner-scoped batch summaries through Firestore listeners. Security Rules permit the owner to read batches, sources, items, and planned families; all writes remain server/admin-owned.

Registration is idempotent. Chunk failure can be retried without creating duplicate sources. Sealing succeeds only when the registered source count matches the declared count.

Firebase resumable uploads remain resumable while the tab is alive. After a browser reload, Seriph offers a retry from the beginning using the same source ID and storage path; it does not claim byte-offset resume when the SDK session URL is unavailable.

## Discovery and archive policy

Discovery never writes catalogue families. It builds inventory and planned-family candidates.

Default archive limits are Remote Config values:

- maximum nesting depth: 4
- maximum entries per batch: 10,000
- maximum expanded bytes per batch: 2 GiB
- maximum expanded bytes per entry: 256 MiB
- maximum compression ratio: 100:1
- maximum normalized entry path: 1,024 bytes
- inline ZIP threshold: 150 MiB compressed
- maximum registered source size: 512 MiB

ZIPs above the inline threshold route to Cloud Run, within the registered source limit. Encrypted ZIPs, unsupported compression, suspicious paths, ZIP bombs, path traversal attempts, and limit violations enter review/quarantine with structured reasons. Other sources continue.

Nested ZIPs receive deterministic child item IDs and task names. Worker redelivery cannot create duplicate nested work. Archive containers are deleted only after discovery completion and durable plan persistence. Cloud Storage soft deletion remains the short-term recovery mechanism.

Known disposable artifacts such as `.DS_Store`, AppleDouble files, checksum sidecars, and verified archive containers are recorded and discarded. Source/design files, documentation, web assets, and extras remain private and linked to inventory/families where confidently attributable. Unknown items enter review.

## Canonical font identity

One shared resolver owns family identity, style identity, technology, canonical filenames, and storage destinations. Planning and persistence consume the same result.

Name precedence is:

1. preferred family/subfamily
2. WWS family/subfamily
3. legacy family/subfamily
4. PostScript and full names
5. OS/2 weight/width and variation metadata
6. filename and source-bundle context as fallback evidence only

Normalization applies Unicode NFC, normalized punctuation and spacing, locale-independent case folding for keys, and case-insensitive collision checks. Display names preserve useful original typography. Non-Latin names receive stable encoded/hash-assisted slugs instead of collapsing to `unknown`.

Obvious weight/style suffixes become logical face attributes. Genuine cuts such as `ABC Ginto Nord` and `ABC Ginto Normal` remain distinct unless typographic metadata explicitly joins them.

Container format comes from signatures and parser evidence. Technology is separate from container format. Non-empty variation axes classify a font as Variable regardless of `.ttf` or `.otf` extension.

## Logical faces, formats, and versions

A catalogue face represents typographic identity; assets represent files.

Logical face identity includes normalized style, OS/2 weight/width, italic/slant, optical cut, variable-axis signature, and PostScript name as a tie-breaker. Each logical face gains an `assets[]` collection containing content hash, container format, detected technology, parsed version, original/public paths, source provenance, and preferred status.

Compatibility fields (`format`, `filename`, `original`, `woff2`, and `contentHash`) continue to project the preferred asset until all readers use `assets[]`.

Asset policy:

- identical SHA-256: duplicate; do not store another public asset
- same face and version in different formats: retain all as variants
- comparable distinct versions: retain all; the highest parsed version is preferred
- incomparable versions: keep the existing preferred asset and retain the new alternate with a review notice
- same format/version but different bytes: retain the existing preferred asset and send the conflict to review
- EOT with matching WOFF/WOFF2 face: record as redundant and do not publish it
- EOT without a matching web face: retain privately/original-only when parseable; otherwise review

Public asset paths remain content-addressed and use at least 64 bits of the hash segment. MIME types come from content detection. Canonical destination collisions are validated case-insensitively before publication.

## Catalogue application

Plan application is transactional per family. The entire clean family group is committed together, preventing first-face partial families from appearing while discovery is still running.

The transaction verifies the planned existing-family version, merges logical faces and asset variants, increments the family version once, records the batch provenance, updates the compact cover/summary fields, and writes a mutation record. Public artifacts are written idempotently to content-addressed paths before the transaction; failed transactions leave reclaimable orphan candidates that cleanup can identify from missing claims.

Concurrent batches targeting the same family re-read and re-plan against the latest family version. They do not overwrite an unexamined newer version.

Catalogue summary rebuilding is coalesced per batch/owner rather than scanning the entire catalogue once per face.

Families become visible immediately after deterministic application. Shelf cache/index revision changes are emitted at family commit, not after AI completion.

## AI enrichment workflow

AI remains asynchronous and cost-aware. Newly catalogued family versions enter a collector every five minutes, with polling every two minutes. The UI reports the real queued state; it does not imply immediate completion.

Before submission, each family is independently validated for owner, visibility, canonical status, faces, preferred asset, and renderability. Invalid records are marked failed/quarantined without aborting valid submissions.

Each AI batch records the complete expected family-job set. Output reconciliation classifies every expected family as applied, stale, missing, malformed, failed, or retryable. Partial Vertex success does not leave silent `enriching` records.

Output applies only when family ID, family version, job ID, prompt version, and model versions still match. A stale output is ignored and the latest family version is queued. Hidden, merged, or deleted families reject output.

Retries are per family with backoff of 5 minutes, 30 minutes, and 2 hours. After three failed attempts, the deterministic family remains usable and enrichment becomes terminal `failed` until manually retried. Expired leases are reclaimed by reconciliation.

Analysis, all required embedding lanes, and search document construction complete in staging. Seriph atomically swaps in the new enrichment/search data only when the replacement is valid. A transient embedding failure never deletes the previous valid enrichment or vectors.

AI batch input/output uses private processing storage with lifecycle cleanup. Structured logs and job-run documents preserve the original exception, stage, family/job IDs, retryability, and attempt.

## Real-time Upload Center

Upload Center is batch-first. A collapsed row shows a summary such as:

`3/3 sources uploaded · 146 items discovered · 8 families catalogued · AI 5/8 · 2 review`

Expanding a batch shows family rows. Expanding a family shows its source/extracted files, applied assets, AI stage, warnings, and errors. Raw inventory remains on demand rather than overwhelming the main view.

The UI supports filters for active, completed, review, and failed batches. Terminal batches remain in recent history for at least 30 days; durable inventory remains available beyond the recent-history window.

Each error exposes stage, reason, retryability, attempt count, and an applicable action: retry, inspect, dismiss review, or cancel remaining work. Errors never disappear merely because they are terminal.

Firestore listeners provide real-time server state. Browser upload progress overlays the matching source while the tab owns the upload task. API polling is a fallback when listeners are unavailable.

The shelf does not render one provisional card per extracted file. It refreshes/inserts real family cards when the transactional family commit advances the library revision. AI progress remains authoritative in Upload Center and updates family detail metadata in place when complete.

## Failure and edge-case behavior

- One malformed source, font, family, or AI row cannot abort unrelated work.
- Partial folder upload applies valid uploaded sources after remaining sources fail, time out, or are canceled, and marks the batch partial.
- Trigger redelivery and worker crashes reuse deterministic task, item, claim, and application IDs.
- A crash after validation resumes the same immutable plan version.
- A crash during family application cannot create a half-written family.
- Duplicate archives and repeated entries collapse by content hash after inventory creation.
- All-duplicate imports succeed as no-op batches with explicit duplicate counts.
- Imports with no valid fonts terminate as failed or needs-review while preserving inventory.
- New faces arriving during AI increment the family version; stale AI output is ignored.
- Family merge/delete during AI invalidates the pending output.
- AI-disabled state is explicit and does not hold deterministic import open indefinitely.
- Batches larger than UI page limits retain correct server counters and outcomes.
- Signing out hides owner-scoped status but does not transfer ownership or expose another user's data.
- Public catalogue/CDN artifacts contain only uploadable font payloads. Source, docs, unknowns, plans, and AI IO stay private.

## Rollback and audit

Every family application writes an import mutation containing the batch/plan version, family precondition version, resulting version, assets added, faces created/changed, and prior preferred asset IDs.

Automatic rollback is allowed only when the family still matches the recorded resulting version. It removes assets introduced solely by the batch and restores prior preferred assets/summary fields. If later edits changed the family, rollback becomes a reviewed three-way repair rather than overwriting newer work.

Post-apply audit verifies item terminality, claim/catalogue consistency, public object existence, family summary counts, AI job reconciliation, and batch counters.

## Production recovery before cutover

The first implementation slice repairs current production without waiting for the full schema migration:

1. Add per-family validation and exception isolation to AI submission.
2. Dry-run an admin reconciler and publish its counts before mutation.
3. Mark malformed `chap` hidden/failed with a quarantine reason instead of deleting it.
4. Restore the 77 hidden aliases to canonical `merged` terminal state and clear stale AI fields.
5. Reconcile the one nonterminal ingest against its family and actual AI state.
6. Requeue the 210 structurally valid ready families through the repaired submitter.
7. Verify one canary family through analysis, embeddings, search indexing, ingest completion, and UI status.
8. Archive legacy canceled/nonterminal noise only through a separately reviewed cleanup operation.

All repair tools are idempotent, owner-aware, dry-run-first, and emit before/after counts.

## Migration and compatibility

The migration is additive before it is subtractive.

1. Introduce batch/source/item/family-plan documents, indexes, rules, and listeners.
2. Route new Import Workspace uploads through the batch API while keeping existing catalogue readers intact.
3. Add `assets[]` and batch provenance while continuing to project existing preferred-asset fields.
4. Run both old active-upload projection and new batch status during a bounded compatibility window.
5. Stop creating legacy per-file ingest records after the new UI and reconciler are proven.
6. Retain read compatibility for historical ingest records, then remove dead preview/upload queue code and old status polling.

No migration rewrites unrelated auth work or existing family IDs.

## Testing strategy

### Unit tests

- Unicode, punctuation, spacing, case, non-Latin slugging, preferred/WWS precedence, style suffixes, genuine family cuts, and PostScript fallbacks.
- Signature-based TTF/OTF/WOFF/WOFF2/EOT detection and Variable classification from axes.
- Logical face keys, format variants, comparable/incomparable versions, EOT policy, and byte deduplication.
- State transitions, derived batch outcomes, retry limits, lease expiry, and immutable plan versions.
- Case-insensitive canonical destination collision detection.

### Archive tests

- Loose folder, single ZIP, multiple families, nested ZIPs, duplicate names, duplicate bytes, and mixed font/source/docs/junk content.
- Corrupt, encrypted, unsupported, traversal, excessive depth, excessive entries, oversized entry, expanded-byte limit, and compression-ratio limit.
- Worker redelivery and crash injection before/after inventory, claim, plan validation, artifact write, and family commit.

### Integration tests

- One-file family, multi-face family, multi-family folder, and archive-plus-loose-file batch.
- Partial upload, client terminal failure, timeout, cancel, retry after reload, all duplicates, no valid fonts, and review-with-clean-families.
- Concurrent batches targeting the same family and same content hash.
- Existing enriched family receiving a new face or alternate format.
- Firestore listener updates and API fallback across more than 100 active items.

### AI tests

- Invalid family preflight, missing row, malformed JSON, duplicate row, partial success, stale version, hidden/merged family, render failure, vector-lane failure, lease expiry, disabled AI, and retry exhaustion.
- Confirm previous enrichment/search vectors remain until a complete replacement commits.
- Confirm one poison family cannot prevent valid families from submission or completion.

### End-to-end canary

Upload a known fixture ZIP containing multiple families, alternate formats, a variable font, a duplicate, documentation, junk, and one unresolved item. Verify inventory, family grouping, catalogue visibility, CDN assets, AI fields, search results, status history, review count, rerun idempotency, and rollback.

## Acceptance criteria

- A clean folder/ZIP automatically produces the exact expected canonical families and logical faces.
- The batch plan is durable and explains every source/extracted item and action.
- Replaying any source event, task, or entire batch creates no duplicate family or asset mutation.
- Valid families continue when another item/family/AI row fails.
- Families are usable after deterministic commit and before AI completion.
- AI output cannot apply to a stale family version.
- Upload Center shows current and terminal status at batch, family, and file levels.
- Failures expose actionable reasons and bounded retry state.
- Distinct formats and meaningful versions are preserved; byte-identical assets are deduplicated.
- Source/docs/extras remain private; only approved font payloads reach public serving paths.
- Production reconciliation leaves no visible canonical family or active import permanently stuck without a terminal or retryable reason.
