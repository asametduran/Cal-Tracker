/**
 * Cal Tracker palette: soft light surfaces, deep navy ink, one warm flame accent for streaks.
 * Cards are white on a pale grey-blue background and separated by soft shadows, not borders.
 */
export const colors = {
  bg: '#F3F5F9',
  /** Raised surface (cards, sheets). */
  card: '#FFFFFF',
  /** Inset surface (inputs, pills, pressed rows). */
  cardAlt: '#E9EDF4',
  /** Hairlines and progress tracks. */
  border: '#E1E6EF',
  text: '#0F1626',
  muted: '#6B7588',
  /** Primary action colour (buttons, selected states): deep navy ink. */
  accent: '#0F1626',
  /** Text on top of the accent colour. */
  onAccent: '#FFFFFF',
  calories: '#0F1626',
  protein: '#E5604D',
  carbs: '#E9A23B',
  fat: '#4C7DFF',
  weight: '#4C5F86',
  /** Flames and streaks. */
  streak: '#FF7A2F',
  success: '#1FA67A',
  danger: '#D9455B',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 10, md: 16, lg: 28 } as const;

/** Soft elevation used by cards, pills and buttons. */
export const shadow = {
  card: { boxShadow: '0 4px 18px rgba(15, 22, 38, 0.07)' },
  raised: { boxShadow: '0 8px 24px rgba(15, 22, 38, 0.18)' },
} as const;
