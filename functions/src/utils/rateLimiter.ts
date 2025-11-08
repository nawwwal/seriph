import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { getConfigNumber } from '../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../config/rcKeys';

function getMaxConcurrentOps(): number {
  return getConfigNumber(RC_KEYS.maxConcurrentOps, Number(RC_DEFAULTS[RC_KEYS.maxConcurrentOps]));
}
const RATE_LIMIT_COLLECTION = '_rateLimits';
const RATE_LIMIT_DOC = 'global';

interface RateLimitState {
  activeCount: number;
  lastUpdated: admin.firestore.Timestamp;
}

/**
 * Acquire a semaphore slot for AI operations
 * Returns true if acquired, false if limit reached
 */
export async function acquireAIOperationSlot(): Promise<boolean> {
  const db = admin.firestore();
  const rateLimitRef = db.collection(RATE_LIMIT_COLLECTION).doc(RATE_LIMIT_DOC);

  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef);
      const currentState = doc.data() as RateLimitState | undefined;
      const currentCount = currentState?.activeCount || 0;

      const limit = getMaxConcurrentOps();
      if (currentCount >= limit) {
        functions.logger.info(`Rate limit reached: ${currentCount}/${limit} active operations`);
        return false;
      }

      transaction.set(rateLimitRef, {
        activeCount: currentCount + 1,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      functions.logger.info(`Acquired AI operation slot: ${currentCount + 1}/${limit}`);
      return true;
    });
  } catch (error: any) {
    functions.logger.error('Error acquiring AI operation slot (fail-closed):', error);
    // Fail-closed to avoid surprise costs
    return false;
  }
}

/**
 * Release a semaphore slot for AI operations
 */
export async function releaseAIOperationSlot(): Promise<void> {
  const db = admin.firestore();
  const rateLimitRef = db.collection(RATE_LIMIT_COLLECTION).doc(RATE_LIMIT_DOC);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef);
      const currentState = doc.data() as RateLimitState | undefined;
      const currentCount = currentState?.activeCount || 0;

      const newCount = Math.max(0, currentCount - 1);
      transaction.set(rateLimitRef, {
        activeCount: newCount,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      const limit = getMaxConcurrentOps();
      functions.logger.info(`Released AI operation slot: ${newCount}/${limit}`);
    });
  } catch (error: any) {
    functions.logger.error('Error releasing AI operation slot:', error);
    // On error, try to decrement anyway
    try {
      await rateLimitRef.set({
        activeCount: admin.firestore.FieldValue.increment(-1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      functions.logger.error('Failed to decrement rate limit counter:', e);
    }
  }
}

/**
 * Wait for an available slot with exponential backoff
 * Returns true if slot acquired, false if timeout
 */
export async function waitForAIOperationSlot(maxWaitMs: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  let attempt = 0;
  const maxAttempts = 10;

  while (Date.now() - startTime < maxWaitMs && attempt < maxAttempts) {
    const acquired = await acquireAIOperationSlot();
    if (acquired) {
      return true;
    }

    // Exponential backoff: 100ms, 200ms, 400ms, etc.
    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
    await new Promise(resolve => setTimeout(resolve, delay));
    attempt++;
  }

  functions.logger.warn(`Timeout waiting for AI operation slot after ${Date.now() - startTime}ms`);
  return false;
}

/**
 * Execute an AI operation with rate limiting
 */
export async function withRateLimit<T>(
  operation: () => Promise<T>,
  operationName: string = 'AI operation'
): Promise<T | null> {
  const acquired = await waitForAIOperationSlot();
  if (!acquired) {
    functions.logger.warn(`Rate limit exceeded for ${operationName}, skipping`);
    return null;
  }

  try {
    return await operation();
  } finally {
    await releaseAIOperationSlot();
  }
}

