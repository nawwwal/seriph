export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const runNext = async (): Promise<void> => {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= items.length) return;
    results[index] = await worker(items[index]!, index);
    await runNext();
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}
