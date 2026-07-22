import type { Firestore } from "firebase-admin/firestore";
import { buildInventoryItem, type InventoryItem } from "./inventory";
import { discoverZip, persistArchiveDiscovery } from "./discoverZip";
import type { ArchiveChild } from "./discoverZip";
import { createItemOnce, importItemRef, markItemTerminalOnce } from "../store/itemStore";
import { reserveArchiveBytesOnce } from "../store/batchStore";
import { importSourceRef } from "../store/paths";
import { transitionSource, type SourceInput } from "../store/sourceStore";
import type { ImportTaskPayload } from "../tasks/enqueue";
import type { ArchiveLimits } from "./archivePolicy";
import type { ImportItemState } from "../contracts/item";
import { requestPlanFinalization } from "../planning/finalizePlan";
import { isMissingStorageObject } from "../tasks/cancellation";

export interface DiscoveryRuntime {
  db: Firestore;
  limits: ArchiveLimits;
  download(path: string): Promise<Buffer>;
  stage(child: ArchiveChild): Promise<void>;
  enqueue(task: ImportTaskPayload): Promise<unknown>;
  isCanceled?: (ownerId: string, batchId: string) => Promise<boolean>;
}

const extensionOf = (name: string): string => { const dot = name.lastIndexOf("."); return dot < 0 ? "" : name.slice(dot).toLowerCase(); };
const sourceInput = (data: Record<string, any>) => ({ ownerId: data.ownerId, batchId: data.batchId, sourceId: data.sourceId,
  originalPath: data.originalPath, archiveLineage: [], filename: data.filename, extension: extensionOf(data.filename), declaredMimeType: data.declaredMimeType });
const sourceLifecycleInput = (data: Record<string, any>): SourceInput => ({ ownerId: data.ownerId, batchId: data.batchId, sourceId: data.sourceId,
  originalPath: data.originalPath, filename: data.filename, declaredSize: data.declaredSize, declaredMimeType: data.declaredMimeType, storagePath: data.storagePath });

async function expandItem(item: InventoryItem, bytes: Buffer, runtime: DiscoveryRuntime): Promise<boolean> {
  const discovery = await discoverZip({ ...item, archiveItemId: item.itemId, bytes, limits: runtime.limits, depth: item.archiveLineage.length,
    isCanceled: () => runtime.isCanceled?.(item.ownerId, item.batchId) ?? Promise.resolve(false),
    reserve: async (reservationId, size) => {
      const result = await reserveArchiveBytesOnce(runtime.db, { ownerId: item.ownerId, batchId: item.batchId, reservationId, bytes: size, maxBytes: runtime.limits.maxExpandedBatchBytes });
      if (result.kind === "batch_missing") throw new Error("import batch missing while reserving archive bytes");
      return result;
    } });
  if (discovery.canceled) return false;
  await persistArchiveDiscovery(runtime.db, item.itemId, discovery, { stage: runtime.stage, enqueue: runtime.enqueue, ownerId: item.ownerId, batchId: item.batchId });
  return true;
}

export async function discoverSourceTask(payload: ImportTaskPayload, runtime: DiscoveryRuntime): Promise<{ status: 204 }> {
  if (await runtime.isCanceled?.(payload.ownerId, payload.batchId)) return { status: 204 };
  const ref = importSourceRef(runtime.db, payload.ownerId, payload.batchId, payload.resourceId); const snap = await ref.get();
  if (!snap.exists) return { status: 204 }; const source = snap.data() as Record<string, any>; if (!["uploaded", "discovering"].includes(source.state)) return { status: 204 };
  const sourceInputValue = sourceLifecycleInput(source);
  let sourceState = source.state as "uploaded" | "discovering";
  if (sourceState === "uploaded") { await transitionSource(runtime.db, sourceInputValue, "uploaded", "discovering"); sourceState = "discovering"; }
  let bytes: Buffer;
  try { bytes = await runtime.download(source.storagePath); }
  catch (error) {
    if (!isMissingStorageObject(error)) throw error;
    try { await transitionSource(runtime.db, sourceInputValue, sourceState, "failed"); } catch { /* cancellation may have won the race */ }
    return { status: 204 };
  }
  if (await runtime.isCanceled?.(payload.ownerId, payload.batchId)) return { status: 204 };
  const item = await buildInventoryItem({ ...sourceInput(source), bytes, name: source.filename });
  await createItemOnce(runtime.db, item);
  if (await runtime.isCanceled?.(payload.ownerId, payload.batchId)) return { status: 204 };
  if (item.role === "archive") { if (!(await expandItem(item, bytes, runtime))) return { status: 204 }; }
  else await runtime.enqueue({ kind: "discover_item", ownerId: item.ownerId, batchId: item.batchId, resourceId: item.itemId, planVersion: 1 });
  await transitionSource(runtime.db, sourceInputValue, "discovering", "discovered");
  if (await runtime.isCanceled?.(payload.ownerId, payload.batchId)) return { status: 204 };
  await requestPlanFinalization(runtime.db, item.ownerId, item.batchId, runtime.enqueue);
  return { status: 204 };
}

const terminalState = (item: InventoryItem): "classified" | "review" | "discarded" => item.action === "review" ? "review" : item.action === "discard" ? "discarded" : "classified";

export async function discoverItemTask(payload: ImportTaskPayload, runtime: DiscoveryRuntime): Promise<{ status: 204 }> {
  if (await runtime.isCanceled?.(payload.ownerId, payload.batchId)) return { status: 204 };
  const ref = importItemRef(runtime.db, payload.ownerId, payload.batchId, payload.resourceId); const snap = await ref.get();
  if (!snap.exists) return { status: 204 }; const item = snap.data() as InventoryItem & { state: ImportItemState; stagingPath?: string };
  if (["classified", "applied", "duplicate", "review", "discarded", "failed"].includes(item.state)) return { status: 204 };
  if (item.role === "archive" && item.stagingPath) {
    let bytes: Buffer;
    try { bytes = await runtime.download(item.stagingPath); }
    catch (error) { if (!isMissingStorageObject(error)) throw error; await markItemTerminalOnce(runtime.db, { ownerId: item.ownerId, batchId: item.batchId, itemId: item.itemId }, "failed"); return { status: 204 }; }
    if (!(await expandItem(item, bytes, runtime))) return { status: 204 };
  }
  else {
    if (await runtime.isCanceled?.(payload.ownerId, payload.batchId)) return { status: 204 };
    await markItemTerminalOnce(runtime.db, { ownerId: item.ownerId, batchId: item.batchId, itemId: item.itemId }, terminalState(item));
    await requestPlanFinalization(runtime.db, item.ownerId, item.batchId, runtime.enqueue);
  }
  return { status: 204 };
}
