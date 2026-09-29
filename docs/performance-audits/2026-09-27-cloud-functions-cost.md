# Cloud Run functions cost audit — 2026-09-27

Project: `seriph`. Baseline: the last 30 days before cutover. The Cloud Billing
report for 2026-08-28 through 2026-09-26 showed **₹457.63 gross Cloud Run
usage** and **₹8.33 gross Cloud Scheduler usage**. Credits offset the gross
charges, so the net amount payable was ₹0. The billing account has no BigQuery
export dataset, so this report does not assign exact rupee charges to individual
functions. Cloud Run gen2 functions appear under Cloud Run in Billing.

## Root cause

Four scheduled functions ran even when there was no work. The two one-minute
enrichment functions alone received 86,378 requests in the 30-day Monitoring
window. Logs repeatedly showed `no pending families`. At cutover, the 109
provider batch jobs had all succeeded, and no live enrichment job, import
source, or import batch needed the old sweep. The live batch scan also found
zero pending dispatches.

Cloud Monitoring window: 2026-08-28 07:45Z to 2026-09-27 07:45Z. Metric:
`run.googleapis.com/container/billable_instance_time`, aligned in one-hour
intervals; request metric: `run.googleapis.com/request_count`. Values are
summed across revisions by `resource.labels.service_name`.

| Retired function | Requests | Billable instance seconds |
| --- | ---: | ---: |
| `submitEnrichmentBatch` | 43,181 | 33,339.86 |
| `pollEnrichmentBatch` | 43,197 | 32,554.37 |
| `watchdogEnrichmentLeases` | 8,641 | 15,730.37 |
| `timeoutAbandonedImportSources` | 2,880 | 9,371.06 |
| **Retired total** | **97,899** | **90,995.67** |
| **All Cloud Run services** | **99,352** | **92,868.34** |

Thus the retired functions accounted for **98.54% of requests** and **97.98%
of billable instance time**. Instance time is a cost proxy, not an exact rupee
allocation: CPU, memory, tier, credits, and other billed SKUs also matter.

## Replacement

- `queueEnrichmentJob` reacts to job creation, retry deadlines, and new leases.
- `queueSourceExpiry` schedules a source callback at its expiry deadline.
- `queueBatchRecovery` schedules a recovery callback for active batches and
  immediately dispatches pending batch work, including failed batches.
- Each event queues a named Cloud Task through the existing private
  `seriph-import` queue. The task name hashes its canonical payload, including
  event ID and observed Firestore version, so redelivered events do not create
  a second task. Superseded timers re-read the document and do nothing.
- `importTaskWorker` handles the callbacks with an authenticated Cloud Tasks
  request. Job claims, source timeout writes, and batch recovery are guarded by
  Firestore transactions. The worker has the Jev secret for existing typed AI
  judgments; changing model providers would not address this idle compute cost.

The four scheduled functions and all four Scheduler jobs were deleted after
the event functions were deployed and exercised. The event functions use
256 MiB and scale to zero. Cloud Tasks already existed for import work.
At the observed volume, its [first million monthly billable operations are
free](https://cloud.google.com/tasks/pricing); [Eventarc Standard pricing](https://cloud.google.com/eventarc/pricing)
and Pub/Sub transport remain possible small additions. [Cloud Run pricing](https://cloud.google.com/run/pricing)
explains why billable instance time is a useful leading measure.

## Production end-to-end checks

The canaries used isolated `cost-audit` Firestore documents and the actual
Eventarc → Cloud Tasks → private worker path. All canary documents and remaining
tasks were removed after verification.

1. A queued enrichment job created a task and reached the expected
   `family_missing` terminal state; two duplicate worker deliveries returned
   HTTP 204 without changing it.
2. A registered source created a 24-hour timer. Delivery of its due callback
   marked it `timed_out` and reconciled its batch.
3. An active batch created a 15-minute timer. Delivery of its due callback
   marked the stale batch `stalled` with `stale_batch`.
4. A failed batch with a pending reconcile task dispatched on the batch write;
   `pendingDispatch` cleared and the private worker completed the task.

Validation used production end-to-end canaries. The functions TypeScript build
and no-emit type check passed. The unit suites were removed in the subsequent
codebase cleanup.

## Post-cutover measure and 90% target

Comparable 2-hour-45-minute idle windows, 14:45–17:30Z on 2026-09-26 and
2026-09-27, from the same Cloud Monitoring metrics:

| Metric, all Cloud Run services | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Requests | 375 | 0 | 100% |
| Billable instance seconds | 336.1 | 1.1 | 99.67% |

The 1.1 seconds after cutover were residual time on the retired revisions;
there were no requests in that window. This **exceeds the 90% target for the
observed idle run rate**. It does **not** yet prove a 90% reduction in the next
30 days of gross Cloud Run billing: that requires the next full billing window
and comparable workload. The target for that window is at most ₹45.76 gross
Cloud Run usage against the ₹457.63 baseline, with Cloud Tasks, Eventarc,
Pub/Sub, Firestore, and Artifact Registry also checked for offsets. The net
payable amount was already ₹0 because of credits, so gross usage is the
meaningful billing comparison.
