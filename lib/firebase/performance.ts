import { app } from '@/lib/firebase/config';

let initialization: Promise<void> | undefined;

async function startPerformanceMonitoring(): Promise<void> {
  try {
    const { getPerformance } = await import('firebase/performance');
    getPerformance(app);
  } catch {
    return;
  }
}

export function initializePerformanceMonitoring(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  initialization ??= startPerformanceMonitoring();
  return initialization;
}
