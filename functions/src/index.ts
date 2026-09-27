// Cloud Functions entry point. Initializes Firebase Admin (side effect) before
// any handler module touches Firestore/Storage, then re-exports the deployed
// functions. Implementation lives in ./triggers/*; resource options in ./options.
import "./bootstrap/adminApp";

export { syncEnrichmentBatchStatus } from "./triggers/enrich";
export { queueEnrichmentJob, queueSourceExpiry, queueBatchRecovery } from "./triggers/due";
export { searchFontsHttpUs, css2, serveFont } from "./triggers/serve";
export { confirmFinalizedImportSource, importTaskWorker } from "./triggers/imports";
export { beforecreated, beforesignedin, beforeemailsent } from "./triggers/auth";
