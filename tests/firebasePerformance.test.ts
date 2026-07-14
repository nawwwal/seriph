import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const performanceSdk = vi.hoisted(() => ({
  getPerformance: vi.fn(),
}));

vi.mock('firebase/performance', () => performanceSdk);
vi.mock('@/lib/firebase/config', () => ({ app: { name: 'seriph' } }));

describe('Firebase Performance Monitoring', () => {
  beforeEach(() => {
    vi.resetModules();
    performanceSdk.getPerformance.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('does nothing during server rendering', async () => {
    const { initializePerformanceMonitoring } = await import('@/lib/firebase/performance');

    await initializePerformanceMonitoring();

    expect(performanceSdk.getPerformance).not.toHaveBeenCalled();
  });

  it('initializes the SDK once in a browser', async () => {
    vi.stubGlobal('window', {});
    const { initializePerformanceMonitoring } = await import('@/lib/firebase/performance');

    await Promise.all([initializePerformanceMonitoring(), initializePerformanceMonitoring()]);

    expect(performanceSdk.getPerformance).toHaveBeenCalledOnce();
  });

  it('ignores optional monitoring failures', async () => {
    vi.stubGlobal('window', {});
    performanceSdk.getPerformance.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    const monitoring = await import('@/lib/firebase/performance');

    await expect(monitoring.initializePerformanceMonitoring()).resolves.toBeUndefined();
  });

  it('mounts monitoring once from the root layout', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');

    expect(layout).toContain('import FirebasePerformance');
    expect(layout.match(/<FirebasePerformance \/>/g)).toHaveLength(1);
  });
});
