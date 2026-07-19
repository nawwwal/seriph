export interface ProviderJobIdentity {
  id?: string;
  jobId?: string;
}

export function providerJobId(job: ProviderJobIdentity): string {
  const id = job.id ?? job.jobId;
  if (!id) throw new Error("enrichment job is missing an id");
  return id;
}

export function expectedJobIds(jobs: readonly ProviderJobIdentity[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const job of jobs) {
    const id = providerJobId(job);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function expectedJobSet(jobs: readonly ProviderJobIdentity[]): Set<string> {
  return new Set(expectedJobIds(jobs));
}
