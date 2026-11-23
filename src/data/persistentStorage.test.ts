import AsyncStorage from '@react-native-async-storage/async-storage';

import { createPersistentStorage } from './persistentStorage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('createPersistentStorage', () => {
  it('loads saved values for its namespace only', async () => {
    await AsyncStorage.setItem('user-a.meals', 'A');
    await AsyncStorage.setItem('user-b.meals', 'B');
    const a = createPersistentStorage('user-a.');
    await a.ready;
    expect(a.getItem('meals')).toBe('A');
    expect(a.getItem('other')).toBeNull();
  });

  it('reads back what it wrote at once and persists it', async () => {
    const s = createPersistentStorage('user-a.');
    await s.ready;
    s.setItem('k', 'v');
    expect(s.getItem('k')).toBe('v');
    await s.flush();
    expect(await AsyncStorage.getItem('user-a.k')).toBe('v');

    const reopened = createPersistentStorage('user-a.');
    await reopened.ready;
    expect(reopened.getItem('k')).toBe('v');
  });

  it('keeps namespaces isolated from each other', async () => {
    const a = createPersistentStorage('user-a.');
    const b = createPersistentStorage('user-b.');
    await Promise.all([a.ready, b.ready]);
    a.setItem('k', 'from-a');
    await a.flush();
    expect(b.getItem('k')).toBeNull();
  });

  it('clear removes the namespace but leaves other users alone', async () => {
    await AsyncStorage.setItem('user-b.k', 'keep');
    const a = createPersistentStorage('user-a.');
    await a.ready;
    a.setItem('k', 'gone');
    await a.flush();
    await a.clear();
    expect(a.getItem('k')).toBeNull();
    expect(await AsyncStorage.getItem('user-a.k')).toBeNull();
    expect(await AsyncStorage.getItem('user-b.k')).toBe('keep');
  });
});
