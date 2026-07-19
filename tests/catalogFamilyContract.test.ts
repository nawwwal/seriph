import { describe, expect, it } from 'vitest';
import { findReadableFamily } from '@/lib/server/catalogFamilyShared';

class FakeCollection {
  constructor(private readonly name: string, private readonly docs: Map<string, Record<string, unknown>>) {}

  doc(id: string) {
    return {
      get: async () => {
        const data = this.docs.get(`${this.name}/${id}`);
        return { id, exists: Boolean(data), data: () => data };
      },
    };
  }

  where() { return this; }
  limit() { return this; }
  async get() {
    return {
      docs: [...this.docs.entries()]
        .filter(([key]) => key.startsWith(`${this.name}/`))
        .map(([key, data]) => ({ id: key.slice(this.name.length + 1), exists: true, data: () => data })),
    };
  }
}

function fakeDb(docs: Record<string, Record<string, unknown>>) {
  const entries = new Map(Object.entries(docs));
  return { collection: (name: string) => {
    if (name === 'users') throw new Error('legacy user-subcollection lookup');
    return new FakeCollection(name, entries);
  } };
}

describe('canonical family lookup', () => {
  it('reads the owner-scoped catalogue document', async () => {
    const db = fakeDb({ 'fontfamilies/user-a__inter': { ownerId: 'user-a', slug: 'inter', faces: [] } });
    await expect(findReadableFamily(db as never, 'user-a', 'inter')).resolves.toMatchObject({ id: 'user-a__inter', exists: true });
  });

  it('rejects a family that exists only in the retired user subcollection', async () => {
    const db = fakeDb({ 'users/user-a/fontfamilies/inter': { ownerId: 'user-a', id: 'inter', fonts: [] } });
    await expect(findReadableFamily(db as never, 'user-a', 'inter')).resolves.toBeNull();
  });
});
