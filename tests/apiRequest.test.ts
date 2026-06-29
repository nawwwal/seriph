import { describe, expect, it } from 'vitest';
import { readJsonObject } from '@/lib/server/apiRequest';

class JsonRequest {
  constructor(private readonly value: unknown, private readonly shouldThrow = false) {}

  async json(): Promise<unknown> {
    if (this.shouldThrow) throw new Error('bad json');
    return this.value;
  }
}

describe('readJsonObject', () => {
  it('returns object bodies', async () => {
    const result = await readJsonObject(new JsonRequest({ q: 'mono' }));

    expect(result).toEqual({ ok: true, value: { q: 'mono' } });
  });

  it('rejects malformed JSON as bad request input', async () => {
    const result = await readJsonObject(new JsonRequest(null, true));

    expect(result).toEqual({ ok: false, message: 'Malformed JSON body' });
  });

  it('rejects non-object JSON as bad request input', async () => {
    const result = await readJsonObject(new JsonRequest(['mono']));

    expect(result).toEqual({ ok: false, message: 'Expected a JSON object body' });
  });
});
