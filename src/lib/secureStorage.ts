/** The subset of expo-secure-store this adapter needs (keys may only contain letters, digits, ".", "-", "_"). */
export type SecureBackend = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/** What supabase-js expects of an auth storage. */
export type AuthStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** iOS Keychain values above ~2 KB are unreliable and a Supabase session is bigger, so values are split. */
const CHUNK_SIZE = 1800;

const countKey = (key: string) => `${key}.count`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

/**
 * Stores values of any size in a small-value secure store by splitting them into chunks. The chunk count
 * is written last, so an interrupted write reads back as "nothing stored" rather than as a corrupt session.
 */
export function createChunkedStorage(backend: SecureBackend, chunkSize: number = CHUNK_SIZE): AuthStorage {
  async function readCount(key: string): Promise<number> {
    const raw = await backend.getItemAsync(countKey(key));
    const n = raw === null ? 0 : Number(raw);
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  async function removeItem(key: string): Promise<void> {
    const count = await readCount(key);
    await backend.deleteItemAsync(countKey(key));
    for (let i = 0; i < count; i++) await backend.deleteItemAsync(chunkKey(key, i));
  }

  return {
    async getItem(key) {
      const count = await readCount(key);
      if (count === 0) return null;
      let value = '';
      for (let i = 0; i < count; i++) {
        const part = await backend.getItemAsync(chunkKey(key, i));
        if (part === null) return null; // a chunk is missing: treat the whole value as gone
        value += part;
      }
      return value;
    },

    async setItem(key, value) {
      await removeItem(key);
      const chunks = Math.max(1, Math.ceil(value.length / chunkSize));
      for (let i = 0; i < chunks; i++) {
        await backend.setItemAsync(chunkKey(key, i), value.slice(i * chunkSize, (i + 1) * chunkSize));
      }
      await backend.setItemAsync(countKey(key), String(chunks));
    },

    removeItem,
  };
}
