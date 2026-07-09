export interface CatalogSummaryBackfillArgs {
  ownerId?: string;
  dryRun: boolean;
}

export function parseCatalogSummaryBackfillArgs(argv: string[]): CatalogSummaryBackfillArgs {
  const parsed: CatalogSummaryBackfillArgs = { dryRun: false };
  for (const arg of argv) {
    if (arg === '--dryRun') parsed.dryRun = true;
    if (arg.startsWith('--ownerId=')) parsed.ownerId = arg.slice('--ownerId='.length);
  }
  return parsed;
}

if (require.main === module) {
  import('./backfillCatalogSummariesRunner')
    .then(({ runCatalogSummaryBackfill }) => runCatalogSummaryBackfill())
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
