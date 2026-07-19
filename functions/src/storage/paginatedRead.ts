import { FieldPath, type Query, type QueryDocumentSnapshot } from "firebase-admin/firestore";

export const AGGREGATE_PAGE_SIZE = 200;
export const AGGREGATE_MAX_ROWS = 100_000;

export class AggregateReadOverflowError extends Error {
  constructor(readonly collectionName: string, readonly maxRows: number) {
    super(`aggregate read exceeded ${maxRows} rows for ${collectionName}`);
    this.name = "AggregateReadOverflowError";
  }
}

export async function readQueryPages<T>(
  query: Query<T>, collectionName: string, pageSize = AGGREGATE_PAGE_SIZE, maxRows = AGGREGATE_MAX_ROWS,
): Promise<readonly QueryDocumentSnapshot<T>[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || !Number.isSafeInteger(maxRows) || maxRows < pageSize) {
    throw new Error("invalid aggregate read bounds");
  }
  const ordered = query.orderBy(FieldPath.documentId()); let cursor: QueryDocumentSnapshot<T> | undefined;
  const rows: QueryDocumentSnapshot<T>[] = [];
  while (true) {
    const page = await (cursor ? ordered.startAfter(cursor) : ordered).limit(pageSize).get();
    rows.push(...page.docs);
    if (page.docs.length < pageSize) return rows;
    if (rows.length >= maxRows) {
      const probe = await ordered.startAfter(page.docs.at(-1)!).limit(1).get();
      if (probe.empty) return rows;
      throw new AggregateReadOverflowError(collectionName, maxRows);
    }
    cursor = page.docs.at(-1);
  }
}
