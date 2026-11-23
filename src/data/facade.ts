import { useSyncExternalStore } from 'react';

import { repositories as localOnly } from './repositories';
import type { Repositories } from './types';

/**
 * Screens import one stable `repositories` object. Behind it sits whichever implementation is
 * active: the device-only store when Supabase isn't configured, or the signed-in user's
 * local-first sync engine. Swapping it never requires touching a screen.
 */
let active: Repositories = localOnly;
let version = 0;
const listeners = new Set<() => void>();

export function getLocalOnlyRepositories(): Repositories {
  return localOnly;
}

/** Tell mounted screens that stored data changed (e.g. a background sync landed) so they reload. */
export function notifyDataChanged(): void {
  version++;
  listeners.forEach((listener) => listener());
}

export function setActiveRepositories(next: Repositories): void {
  active = next;
  notifyDataChanged();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes whenever stored data may have changed; include it in a screen's load dependencies. */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

type Methods = Record<string, (...args: unknown[]) => unknown>;

function delegate<K extends keyof Repositories>(domain: K): Repositories[K] {
  return new Proxy(
    {},
    {
      get:
        (_target, method: string) =>
        (...args: unknown[]) =>
          (active[domain] as unknown as Methods)[method](...args),
    },
  ) as Repositories[K];
}

export const repositories: Repositories = {
  meals: delegate('meals'),
  goals: delegate('goals'),
  reminders: delegate('reminders'),
  profile: delegate('profile'),
  weights: delegate('weights'),
};
