export type TimeOfDay = { hour: number; minute: number };

/** Parses 24-hour `H:MM` / `HH:MM` text. Returns null for anything else. */
export function parseTime(text: string): TimeOfDay | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

export function formatTime({ hour, minute }: TimeOfDay): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
