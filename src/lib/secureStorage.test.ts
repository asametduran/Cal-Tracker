import { createChunkedStorage, type SecureBackend } from './secureStorage';

function fakeBackend() {
  const map = new Map<string, string>();
  const backend: SecureBackend = {
    getItemAsync: async (k) => map.get(k) ?? null,
    setItemAsync: async (k, v) => {
      if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error(`invalid key ${k}`);
      map.set(k, v);
    },
    deleteItemAsync: async (k) => {
      map.delete(k);
    },
  };
  return { map, backend };
}

const KEY = 'sb-abc123-auth-token';

describe('createChunkedStorage', () => {
  it('round-trips a value larger than one chunk', async () => {
    const { backend, map } = fakeBackend();
    const store = createChunkedStorage(backend, 10);
    const value = JSON.stringify({ access_token: 'x'.repeat(95), refresh_token: 'y'.repeat(20) });
    await store.setItem(KEY, value);
    expect(await store.getItem(KEY)).toBe(value);
    expect(map.size).toBeGreaterThan(2);
    for (const stored of map.values()) expect(stored.length).toBeLessThanOrEqual(10);
  });

  it('only uses keys SecureStore accepts', async () => {
    const { backend } = fakeBackend();
    await expect(createChunkedStorage(backend, 10).setItem(KEY, 'a'.repeat(50))).resolves.toBeUndefined();
  });

  it('returns null for a key that was never stored', async () => {
    expect(await createChunkedStorage(fakeBackend().backend).getItem(KEY)).toBeNull();
  });

  it('overwrites a longer value with a shorter one without leaving old chunks behind', async () => {
    const { backend, map } = fakeBackend();
    const store = createChunkedStorage(backend, 10);
    await store.setItem(KEY, 'a'.repeat(95));
    await store.setItem(KEY, 'short');
    expect(await store.getItem(KEY)).toBe('short');
    expect(map.size).toBe(2); // one chunk + the count
  });

  it('removes every chunk', async () => {
    const { backend, map } = fakeBackend();
    const store = createChunkedStorage(backend, 10);
    await store.setItem(KEY, 'a'.repeat(95));
    await store.removeItem(KEY);
    expect(await store.getItem(KEY)).toBeNull();
    expect(map.size).toBe(0);
  });

  it('treats a missing chunk or a corrupt count as nothing stored', async () => {
    const { backend, map } = fakeBackend();
    const store = createChunkedStorage(backend, 10);
    await store.setItem(KEY, 'a'.repeat(95));
    map.delete(`${KEY}.3`);
    expect(await store.getItem(KEY)).toBeNull();
    map.set(`${KEY}.count`, 'banana');
    expect(await store.getItem(KEY)).toBeNull();
  });

  it('stores an empty string', async () => {
    const store = createChunkedStorage(fakeBackend().backend);
    await store.setItem(KEY, '');
    expect(await store.getItem(KEY)).toBe('');
  });
});
