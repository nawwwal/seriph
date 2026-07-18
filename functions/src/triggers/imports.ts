import { onRequest } from "firebase-functions/v2/https";
import { dispatchImportTask } from "../imports/tasks/dispatch";
import { IMPORT_TASK_WORKER_OPTIONS } from "../options";

export const importTaskWorker = onRequest(IMPORT_TASK_WORKER_OPTIONS, async (req, res) => {
  const result = await dispatchImportTask({
    body: req.body,
    cloudTaskName: req.get("X-CloudTasks-TaskName"),
  });
  res.status(result.status).send();
});
