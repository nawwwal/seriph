type Data = Record<string, any>;

export const sourceBytes = Buffer.from("integration font bytes");

export const firestore: any = (() => {
  const docs = new Map<string, Data>();
  const writes: string[] = [];
  const ref = (path: string): any => ({ path, firestore, id: path.split("/").pop(),
    collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }) });
  const db: any = { docs, writes, collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }) };
  db.runTransaction = async (run: (tx: any) => Promise<unknown>) => run({
    get: (document: any) => document.get(),
    set: (document: any, data: Data, options?: { merge?: boolean }) => {
      docs.set(document.path, options?.merge ? { ...docs.get(document.path), ...data } : data); writes.push(document.path);
    },
  });
  return db;
})();

export const bucket: any = { saved: [] as string[], file: (path: string) => ({
  download: async () => [sourceBytes], save: async () => { bucket.saved.push(path); },
}) };

export function seedApplyFamily(sha: string): void {
  firestore.docs.set("users/owner-1/importBatches/batch-1/plans/2", { ownerId: "owner-1", batchId: "batch-1", planVersion: 2, state: "validated",
    items: [{ id: "item-1", itemId: "item-1", sha256: sha, action: "apply", reasonCode: "planned", reasonCodes: [], familyId: "atlas", logicalFaceKey: "regular" }],
    families: [{ familyId: "atlas", familyName: "Atlas", familySlug: "atlas", clean: true, faces: [{ logicalFaceKey: "regular", styleName: "Regular", weight: 400, width: 100, italic: false,
      assets: [{ assetId: "asset-1", itemId: "item-1", sha256: sha, format: "WOFF", version: "1" }] }] }], reviewItems: [], expectedFamilyVersions: { atlas: 0 } });
  firestore.docs.set("users/owner-1/importBatches/batch-1/plans/2/applyTasks/atlas", { expectedFamilyVersion: 0 });
  firestore.docs.set("users/owner-1/importBatches/batch-1/items/item-1", { stagingPath: "intake/atlas/item-1" });
  firestore.docs.set(`users/owner-1/assetClaims/${sha}`, { ownerId: "owner-1", batchId: "batch-1", itemId: "item-1", sha256: sha, familyId: "atlas", logicalFaceKey: "regular",
    assetId: "asset-1", claimId: "batch-1:item-1", status: "leased", leaseExpiresAt: new Date("2030-01-01") });
}
