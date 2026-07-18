import { describe, expect, it, vi } from 'vitest';
import { createImportBatchChildrenController, type ImportBatchChildrenListener } from '@/lib/hooks/useImportBatchChildren';

function childHarness() {
  const subscriptions: Array<{ kind: string; rows: (rows: unknown[]) => void; stop: ReturnType<typeof vi.fn> }> = [];
  const listener: ImportBatchChildrenListener = { subscribe(_batchId, kind, rows) { const subscription = { kind, rows, stop: vi.fn() }; subscriptions.push(subscription); return subscription.stop; } };
  return { listener, subscriptions };
}

describe('durable import child lifecycle', () => {
  it('settles a pending load by rejection when collapsed', async () => {
    const fake = childHarness(); const controller = createImportBatchChildrenController({ listener: fake.listener }); const pending = controller.loadChildren('b1');
    controller.collapse('b1');
    await expect(pending).rejects.toThrow('cancelled');
  });

  it('rejects replaced loads and unsubscribes the old expansion', async () => {
    const fake = childHarness(); const controller = createImportBatchChildrenController({ listener: fake.listener }); const first = controller.loadChildren('b1'); const second = controller.loadChildren('b2');
    await expect(first).rejects.toThrow('cancelled'); controller.close(); await expect(second).rejects.toThrow('cancelled'); expect(fake.subscriptions.slice(0, 2).every(({ stop }) => stop.mock.calls.length === 1)).toBe(true);
  });
});
