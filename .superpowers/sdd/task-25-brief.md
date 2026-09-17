### Task 25: Add family/item drill-down and retry/cancel actions

**Files:**
- Create: `components/upload/UploadFamilyRow.tsx`
- Create: `components/upload/UploadItemRow.tsx`
- Create: `components/upload/UploadReviewPanel.tsx`
- Create: `lib/imports/importBatchActions.ts`
- Test: `tests/uploadCenterDetails.test.ts`

**Interfaces:**
- Consumes: Task 23 lazy children and Task 9/Task 26 command routes.
- Produces: family/file/review details with stage, reason, attempts, provenance, retry, inspect, and cancel.

- [ ] **Step 1: Write detail/action tests.**

```ts
it("shows actionable structured errors without exposing private paths", () => {
  const html = renderDetails(reviewFixture);
  expect(html).toContain("Path traversal blocked");
  expect(html).toContain("Attempt 1 of 3");
  expect(html).toContain("Retry");
  expect(html).not.toContain("gs://");
});
```

- [ ] **Step 2: Run RED.**

Run: `npm test -- tests/uploadCenterDetails.test.ts`

Expected: FAIL because child rows/actions do not exist.

- [ ] **Step 3: Implement nested rows and an allowlisted action client.**

```ts
import type { RetryTarget } from "@/models/import-batch.models";

export interface ImportBatchActionRequest {
  batchId: string;
  idempotencyKey: string;
  target: RetryTarget;
}
```

Family rows show intended/catalogued identity, face/asset counts, catalogue link, deterministic state, and AI state. Item rows show original path, archive lineage, format/technology, action/reason, attempt, and error. Review panel groups unresolved reasons. Buttons disable during command submission and display returned command errors inline.

- [ ] **Step 4: Run GREEN and accessibility-oriented markup checks.**

Run: `npm test -- tests/uploadCenterDetails.test.ts tests/buttonStyles.test.ts && npm run typecheck`

Expected: PASS; nested controls have names/expanded state and private processing paths remain absent.

- [ ] **Step 5: Commit.**

```bash
git add components/upload/UploadFamilyRow.tsx components/upload/UploadItemRow.tsx components/upload/UploadReviewPanel.tsx lib/imports/importBatchActions.ts tests/uploadCenterDetails.test.ts
git commit -m "feat: expose import details and actions"
```
