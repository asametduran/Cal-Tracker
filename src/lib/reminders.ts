import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Reminder } from '@/data/types';

export type SyncResult =
  | { status: 'scheduled'; count: number }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'error' };

const CHANNEL_ID = 'meal-reminders';

/** Show reminders as banners even while the app is open. Call once at startup. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Replaces all scheduled meal reminders with the enabled ones in `reminders`, firing daily. */
export async function syncReminders(reminders: Reminder[]): Promise<SyncResult> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const active = reminders.filter((r) => r.enabled);
    if (active.length === 0) return { status: 'scheduled', count: 0 };

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Meal reminders',
        // eslint-disable-next-line import/namespace -- re-exported via `export *`, which the rule can't follow
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };

    for (const reminder of active) {
      await Notifications.scheduleNotificationAsync({
        content: { title: reminder.name, body: 'Time to log your meal 📸' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: reminder.hour,
          minute: reminder.minute,
          channelId: CHANNEL_ID,
        },
      });
    }
    return { status: 'scheduled', count: active.length };
  } catch {
    return { status: 'error' };
  }
}
