import type { Reminder } from '@/data/types';

import type { SyncResult } from './reminders';

/** Browsers can't schedule local notifications, so reminders are saved but never fire on web. */
export function configureNotifications(): void {}

export async function syncReminders(_reminders: Reminder[]): Promise<SyncResult> {
  return { status: 'unsupported' };
}
