// Discovery loads every group; deployed instances load only their own group.
// Auth has a seven-second deadline, including container and module startup.
import "./bootstrap/adminApp";

function loadTriggers<T extends object>(names: readonly string[], load: () => T): Partial<T> {
  const target = process.env.FUNCTION_TARGET;
  return !target || names.includes(target) ? load() : {};
}

export const { beforecreated, beforesignedin, beforeemailsent } = loadTriggers(
  ["beforecreated", "beforesignedin", "beforeemailsent"],
  () => require("./triggers/auth") as typeof import("./triggers/auth.js")
);
export const { syncEnrichmentBatchStatus } = loadTriggers(
  ["syncEnrichmentBatchStatus"],
  () => require("./triggers/enrich") as typeof import("./triggers/enrich.js")
);
export const { queueEnrichmentJob, queueSourceExpiry, queueBatchRecovery } = loadTriggers(
  ["queueEnrichmentJob", "queueSourceExpiry", "queueBatchRecovery"],
  () => require("./triggers/due") as typeof import("./triggers/due.js")
);
export const { searchFontsHttpUs, css2, serveFont } = loadTriggers(
  ["searchFontsHttpUs", "css2", "serveFont"],
  () => require("./triggers/serve") as typeof import("./triggers/serve.js")
);
export const { confirmFinalizedImportSource, importTaskWorker } = loadTriggers(
  ["confirmFinalizedImportSource", "importTaskWorker"],
  () => require("./triggers/imports") as typeof import("./triggers/imports.js")
);
