import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStorage } from './repositories.web';

export type PersistentStorage = KeyValueStorage & {
  /** Resolves once saved values have been loaded into memory. Await before first use. */
  ready: Promise<void>;
  /** Resolves when every write issued so far has reached disk. */
  flush(): Promise<void>;
  /** Deletes everything under this namespace (used on sign-out). */
  clear(): Promise<void>;
};

/**
 * Synchronous key-value store backed by AsyncStorage: values are loaded into memory once, reads are
 * instant, and writes go through to disk in the background. Each namespace (one per user) is isolated.
 */
export function createPersistentStorage(namespace: string): PersistentStorage {
  const memory = new Map<string, string>();
  const pending = new Set<Promise<void>>();

  const ready = (async () => {
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(namespace));
      const pairs = await AsyncStorage.multiGet(keys);
      for (const [key, value] of pairs) {
        if (value !== null) memory.set(key.slice(namespace.length), value);
      }
    } catch {
      // Unreadable storage: start empty and rebuild from the server.
    }
  })();

  return {
    ready,
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
      const write: Promise<void> = AsyncStorage.setItem(namespace + key, value)
        .catch(() => {})
        .finally(() => pending.delete(write));
      pending.add(write);
    },
    flush: async () => {
      await Promise.all([...pending]);
    },
    clear: async () => {
      const keys = [...memory.keys()].map((k) => namespace + k);
      memory.clear();
      await Promise.all([...pending]);
      try {
        await AsyncStorage.multiRemove(keys);
      } catch {
        // Best effort.
      }
    },
  };
}
