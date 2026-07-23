# Progressive Import Tray

## Goal

Make every import feel active and legible from the moment files are selected until catalogue and AI work finish. The tray must show the best information Seriph has at each stage without exposing pipeline jargon or duplicating status around the app.

## Interaction model

Seriph uses one bottom upload tray across the app.

- The collapsed tray is the default. It contains one primary message, one supporting status line, a progress indicator when measurable, and the relevant action.
- The tray expands only when Seriph has useful family or error detail to show.
- Active imports can always be cancelled.
- Completed imports disappear after a short confirmation.
- New failures remain until dismissed or retried. Historical terminal batches do not reappear on page load.
- Empty review states, repeated batch labels, raw counters, and internal task names are never shown.

## Progressive disclosure

The display advances as better data becomes available:

1. **Selected:** show the selected font filenames, folder name, or archive name immediately.
2. **Uploading:** show upload progress and a compact source summary.
3. **Inspecting:** show that Seriph is reading font metadata and archives.
4. **Families found:** replace provisional filenames with canonical family names as family plans arrive. Include the number of discovered styles.
5. **Importing:** show per-family catalogue progress.
6. **Enriching:** retain the family names and show AI enrichment as the secondary stage.
7. **Done:** confirm how many families and styles were added, then dismiss automatically.

For loose font files, filenames provide immediate provisional identity. For a ZIP, Seriph shows the archive name until extraction discovers its families. The UI must not invent family names from the archive filename.

## Data flow

`UploadContext` owns ephemeral client source identity alongside byte progress. `useDurableBatchUpload` publishes the selected source names before the first network request and clears them when the upload leaves client control.

`UploadTray` subscribes to the active batch and loads its family children as soon as a batch ID exists. It keeps the child listener open while the tray is active, so detected families appear without an expand click. The tray derives a presentation model from:

- client source names and byte progress;
- batch stage and counters;
- family-plan names, face/style counts, and enrichment state;
- current notices and terminal outcome.

The presentation model prefers canonical family data over provisional source names. It must tolerate incomplete documents because discovery writes fields incrementally.

## Layout and hierarchy

Collapsed:

- leading stage icon;
- primary line: family names when known, otherwise selected source summary;
- secondary line: plain-language stage plus the most useful count or percentage;
- `Cancel` while active, `Dismiss` after terminal failure;
- a disclosure control only when family or error details exist.

Expanded:

- one compact row per detected family;
- family name as the row heading;
- style or face summary immediately below it;
- small status labels for catalogue and AI work;
- retry controls only on the failed row;
- unresolved items only when at least one exists.

The expanded panel uses the current theme tokens, border language, spacing scale, and type hierarchy. It must not resemble a second modal.

## Failure and recovery

- A client upload failure names the affected source when available.
- A family failure keeps successfully detected families visible and marks only the failed row.
- A batch with review items opens those items under a clear `Needs review` section.
- Cancellation changes the tray to a short cancelled confirmation and then removes it.
- Reloading the app never resurrects old completed or failed trays.

## Verification policy

Do not add component or snapshot tests for this UI. Remove the temporary upload-tray component test. Verify the feature through:

- the existing import API and pipeline integration boundary;
- a real browser upload against the running local app;
- lint, type/build, and production deployment checks.

## Non-goals

- A permanent import history screen.
- A raw task-event timeline.
- Client-side ZIP extraction solely for preview.
- Duplicate status indicators in catalogue rows, toasts, or page headers.
