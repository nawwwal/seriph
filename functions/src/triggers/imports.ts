import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db } from "../bootstrap/adminApp";
import { resolveImportTriggerBucket } from "../imports/config/sourceTriggerConfig";
import { getImportConfig } from "../imports/config/importConfig";
import { getConfigValue } from "../config/remoteConfig";
import { RC_DEFAULTS, RC_KEYS } from "../config/rcKeys";
import { confirmFinalizedSource, firestoreSourceLifecycleStore } from "../imports/reconcile/sourceFinalized";
import { expireSources, firestoreSourceTimeoutStore } from "../imports/reconcile/sourceTimeout";
import { dispatchImportTask, productionImportStages } from "../imports/tasks/dispatch";
import { enqueueImportTask } from "../imports/tasks/enqueue";
import { IMPORT_SOURCE_FINALIZED_OPTIONS, IMPORT_SOURCE_TIMEOUT_OPTIONS, IMPORT_TASK_WORKER_OPTIONS } from "../options";

// Pass the deployment environment explicitly so this trigger's bucket and
// task-delivery contract are captured by the Functions revision.
const sourceBucket = resolveImportTriggerBucket(process.env);

export const importTaskWorker = onRequest(IMPORT_TASK_WORKER_OPTIONS, async (req, res) => {
  const cloudTaskName = req.get("X-CloudTasks-TaskName");
  const result = await dispatchImportTask({ body: req.body, cloudTaskName }, { stages: productionImportStages });
  if (result.status === 503) logger.error("Import task failed", { cloudTaskName, body: req.body });
  res.status(result.status).send();
});

export const confirmFinalizedImportSource = onObjectFinalized({ ...IMPORT_SOURCE_FINALIZED_OPTIONS, bucket: sourceBucket }, async (event) => {
  const data = event.data;
  if (!data?.name || !data.generation || data.size === undefined) return { kind: "ignored" } as const;
  const prefix = getConfigValue(RC_KEYS.intakeBucketPath, RC_DEFAULTS[RC_KEYS.intakeBucketPath]);
  return confirmFinalizedSource({ name: data.name, generation: String(data.generation), size: Number(data.size) },
    firestoreSourceLifecycleStore({ db, enqueue: enqueueImportTask }), prefix);
});

export const timeoutAbandonedImportSources = onSchedule(IMPORT_SOURCE_TIMEOUT_OPTIONS, async () => {
  await expireSources(firestoreSourceTimeoutStore({ db, enqueue: enqueueImportTask }),
    { now: () => Date.now() }, getImportConfig().sourceTimeoutMinutes);
});
