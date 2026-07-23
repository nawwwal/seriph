export async function mapWithConcurrency<T, R>(values: readonly T[], limit: number, work: (value: T) => Promise<R>): Promise<R[]> {
  if (values.length === 0) return [];
  const results = new Array<R>(values.length);
  let next = 0;
  const worker = async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await work(values[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), values.length) }, worker));
  return results;
}
