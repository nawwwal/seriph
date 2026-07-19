import fs from "node:fs";
import path from "node:path";

export type CanaryRecord = Record<string, unknown>;
export type CanarySnapshot = {
  receipts: Record<string, CanaryRecord>;
  mutations: Record<string, CanaryRecord>;
  publicObjects: Record<string, CanaryRecord>;
};
type Table = keyof CanarySnapshot;
type CanaryTables = Record<Table, Map<string, CanaryRecord>>;

const emptySnapshot = (): CanarySnapshot => ({ receipts: {}, mutations: {}, publicObjects: {} });
const toTables = (snapshot: CanarySnapshot): CanaryTables => ({
  receipts: new Map(Object.entries(snapshot.receipts)),
  mutations: new Map(Object.entries(snapshot.mutations)),
  publicObjects: new Map(Object.entries(snapshot.publicObjects)),
});
const toSnapshot = (tables: CanaryTables): CanarySnapshot => ({
  receipts: Object.fromEntries(tables.receipts),
  mutations: Object.fromEntries(tables.mutations),
  publicObjects: Object.fromEntries(tables.publicObjects),
});

export class DurableCanaryStore {
  private readonly tables: CanaryTables;

  constructor(private readonly filename: string) {
    this.tables = toTables(this.read());
  }

  private read(): CanarySnapshot {
    if (!fs.existsSync(this.filename)) return emptySnapshot();
    return JSON.parse(fs.readFileSync(this.filename, "utf8")) as CanarySnapshot;
  }

  private write(snapshot: CanarySnapshot) {
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    const temporary = `${this.filename}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(snapshot));
    fs.renameSync(temporary, this.filename);
  }

  put(table: Table, id: string, record: CanaryRecord): boolean {
    const records = this.tables[table];
    if (records.has(id)) return false;
    records.set(id, { id, ...record });
    this.write(toSnapshot(this.tables));
    return true;
  }

  snapshot() {
    return toSnapshot(this.tables);
  }
}
