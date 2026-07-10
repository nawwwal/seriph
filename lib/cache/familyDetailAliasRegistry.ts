import { readSnapshot, writeSnapshot } from '@/lib/cache/persistentSnapshots';

const ALIAS_REGISTRY_KEY = 'registry';
const DETAIL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
type FamilyDetailAliasRegistry = Record<string, string[]>;
const mutationsByAccount = new Map<string, Promise<void>>();

function enqueueRegistryMutation<T>(accountId: string, operation: () => Promise<T>): Promise<T> {
  const previous = mutationsByAccount.get(accountId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  const release = next.then(() => undefined, () => undefined);
  mutationsByAccount.set(accountId, release);
  void release.then(() => {
    if (mutationsByAccount.get(accountId) === release) mutationsByAccount.delete(accountId);
  });
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function registryFrom(payload: unknown): FamilyDetailAliasRegistry {
  if (!isRecord(payload)) return {};
  const registry: FamilyDetailAliasRegistry = {};
  for (const [canonicalId, aliases] of Object.entries(payload)) {
    if (!Array.isArray(aliases) || canonicalId.length === 0) continue;
    const values = unique(aliases.filter((alias): alias is string => typeof alias === 'string'));
    if (values.length > 0) registry[canonicalId] = unique([canonicalId, ...values]);
  }
  return registry;
}

async function readRegistry(accountId: string): Promise<FamilyDetailAliasRegistry> {
  // This kind stays outside the 24-entry detail LRU so aliases survive detail eviction.
  const snapshot = await readSnapshot({ accountId, kind: 'family-detail-aliases', key: ALIAS_REGISTRY_KEY });
  return snapshot ? registryFrom(snapshot.payload) : {};
}

async function writeRegistry(accountId: string, registry: FamilyDetailAliasRegistry): Promise<void> {
  await writeSnapshot({
    accountId,
    kind: 'family-detail-aliases',
    key: ALIAS_REGISTRY_KEY,
    payload: registry,
    ttlMs: Object.keys(registry).length > 0 ? DETAIL_TTL_MS : 0,
  });
}

function linkedAliases(registry: FamilyDetailAliasRegistry, aliases: string[]): string[] {
  const linked = new Set(unique(aliases));
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const [canonicalId, group] of Object.entries(registry)) {
      const candidates = [canonicalId, ...group];
      if (!candidates.some((candidate) => linked.has(candidate))) continue;
      for (const candidate of candidates) {
        if (!linked.has(candidate)) {
          linked.add(candidate);
          expanded = true;
        }
      }
    }
  }
  return [...linked];
}

function withoutLinkedGroups(registry: FamilyDetailAliasRegistry, aliases: string[]): FamilyDetailAliasRegistry {
  const linked = new Set(aliases);
  const next: FamilyDetailAliasRegistry = {};
  for (const [canonicalId, group] of Object.entries(registry)) {
    if (![canonicalId, ...group].some((candidate) => linked.has(candidate))) next[canonicalId] = group;
  }
  return next;
}

export function rememberPersistedFamilyDetailAliases(input: {
  accountId: string;
  canonicalId: string;
  aliases: string[];
}): Promise<void> {
  return enqueueRegistryMutation(input.accountId, async () => {
    const registry = await readRegistry(input.accountId);
    const aliases = linkedAliases(registry, [input.canonicalId, ...input.aliases]);
    const next = withoutLinkedGroups(registry, aliases);
    next[input.canonicalId] = aliases;
    await writeRegistry(input.accountId, next);
  });
}

export function takePersistedFamilyDetailAliases(input: {
  accountId: string;
  familyId: string;
}): Promise<string[]> {
  return enqueueRegistryMutation(input.accountId, async () => {
    const registry = await readRegistry(input.accountId);
    const aliases = linkedAliases(registry, [input.familyId]);
    const next = withoutLinkedGroups(registry, aliases);
    if (Object.keys(next).length !== Object.keys(registry).length) await writeRegistry(input.accountId, next);
    return aliases;
  });
}
