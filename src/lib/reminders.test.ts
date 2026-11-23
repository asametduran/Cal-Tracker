import * as Notifications from 'expo-notifications';

import type { Reminder } from '@/data/types';

import { syncReminders } from './reminders';

jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  setNotificationChannelAsync: jest.fn(async () => {}),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

const mocked = Notifications as jest.Mocked<typeof Notifications>;

const reminder = (over: Partial<Reminder>): Reminder => ({
  id: 'r',
  name: 'Lunch',
  hour: 12,
  minute: 30,
  enabled: true,
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('syncReminders', () => {
  it('cancels old reminders, then schedules only enabled ones daily at their time', async () => {
    const result = await syncReminders([
      reminder({ id: 'a', name: 'Breakfast', hour: 8, minute: 0 }),
      reminder({ id: 'b', name: 'Lunch', enabled: false }),
      reminder({ id: 'c', name: 'Dinner', hour: 18, minute: 45 }),
    ]);
    expect(result).toEqual({ status: 'scheduled', count: 2 });
    expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: 'Dinner' }),
        trigger: expect.objectContaining({ type: 'daily', hour: 18, minute: 45 }),
      }),
    );
  });

  it('does not ask for permission when nothing is enabled', async () => {
    const result = await syncReminders([reminder({ enabled: false })]);
    expect(result).toEqual({ status: 'scheduled', count: 0 });
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('reports denied and schedules nothing when permission is refused', async () => {
    mocked.requestPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    const result = await syncReminders([reminder({})]);
    expect(result).toEqual({ status: 'denied' });
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('reports error instead of throwing when scheduling fails', async () => {
    mocked.scheduleNotificationAsync.mockRejectedValueOnce(new Error('boom'));
    expect(await syncReminders([reminder({})])).toEqual({ status: 'error' });
  });
});
