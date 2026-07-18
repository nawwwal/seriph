import type { Firestore } from "firebase-admin/firestore";
import { buildInventoryItem, type InventoryItem } from "./inventory";
import { discoverZip, persistArchiveDiscovery } from "./discoverZip";
import type { ArchiveChild } from "./discoverZip";
import { createItemOnce, importItemRef, markItemTerminalOnce } from "../store/itemStore";
import { importSourceRef } from "../store/paths";
import { transitionSource, type SourceInput } from "../store/sourceStore";
import type { ImportTaskPayload } from "../tasks/enqueue";
import type { ArchiveLimits } from "./archivePolicy";
import type { ImportItemState } from "../contracts/item";

export interface DiscoveryRuntime {
  db: Firestore;
  limits: ArchiveLimits;
  download(path: string): Promise<Buffer>;
  stage(child: ArchiveChild): Promise<void>;
  enqueue(task: ImportTaskPayload): Promise<unknown>;
}

const extensionOf = (name: string): string => { const dot = name.lastIndexOf("."); return dot < 0 ? "" : name.slice(dot).toLowerCase(); };
const sourceInput = (data: Record<string, any>) => ({ ownerId: data.ownerId, batchId: data.batchId, sourceId: data.sourceId,
  originalPath: data.originalPath, archiveLineage: [], filename: data.filename, extension: extensionOf(data.filename), declaredMimeType: data.declaredMimeType });

async function expandItem(item: InventoryItem, bytes: Buffer, runtime: DiscoveryRuntime): Promise<void> {
  const discovery = await discoverZip({ ...item, archiveItemId: item.itemId, bytes, limits: runtime.limits, depth: item.archiveLineage.length });
  await persistArchiveDiscovery(runtime.db, item.itemId, discovery, { stage: runtime.stage, enqueue: runtime.enqueue, ownerId: item.ownerId, batchId: item.batchId });
}

export async function discoverSourceTask(payload: ImportTaskPayload, runtime: DiscoveryRuntime): Promise<{ status: 204 }> {
  const ref = importSourceRef(runtime.db, payload.ownerId, payload.batchId, payload.resourceId); const snap = await ref.get();
  if (!snap.exists) return { status: 204 }; const source = snap.data() as Record<string, any>; if (!["uploaded", "discovering"].includes(source.state)) return { status: 204 };
  const sourceInputValue = source as SourceInput;
  if (source.state === "uploaded") await transitionSource(runtime.db, sourceInputValue, "uploaded", "discovering");
  const bytes = await runtime.download(source.storagePath); const item = await buildInventoryItem({ ...sourceInput(source), bytes, name: source.filename });
  await createItemOnce(runtime.db, item);
  if (item.role === "archive") await expandItem(item, bytes, runtime); else await runtime.enqueue({ kind: "discover_item", ownerId: item.ownerId, batchId: item.batchId, resourceId: item.itemId, planVersion: 1 });
  await transitionSource(runtime.db, sourceInputValue, "discovering", "discovered");
  return { status: 204 };
}

const terminalState = (item: InventoryItem): "classified" | "review" | "discarded" => item.action === "review" ? "review" : item.action === "discard" ? "discarded" : "classified";

export async function discoverItemTask(payload: ImportTaskPayload, runtime: DiscoveryRuntime): Promise<{ status: 204 }> {
  const ref = importItemRef(runtime.db, payload.ownerId, payload.batchId, payload.resourceId); const snap = await ref.get();
  if (!snap.exists) return { status: 204 }; const item = snap.data() as InventoryItem & { state: ImportItemState; stagingPath?: string };
  if (["classified", "applied", "duplicate", "review", "discarded", "failed"].includes(item.state)) return { status: 204 };
  if (item.role === "archive" && item.stagingPath) await expandItem(item, await runtime.download(item.stagingPath), runtime);
  else await markItemTerminalOnce(runtime.db, { ownerId: item.ownerId, batchId: item.batchId, itemId: item.itemId }, terminalState(item));
  return { status: 204 };
}
