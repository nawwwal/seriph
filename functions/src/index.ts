// Cloud Functions entry point. Initializes Firebase Admin (side effect) before
// any handler module touches Firestore/Storage, then re-exports the deployed
// functions. Implementation lives in ./triggers/*; resource options in ./options.
import "./bootstrap/adminApp";

export { expandArchive, processUploadedFontStorage } from "./triggers/ingest";
export { submitEnrichmentBatch, pollEnrichmentBatch } from "./triggers/enrich";
export { searchFontsHttpUs, css2, serveFont } from "./triggers/serve";
