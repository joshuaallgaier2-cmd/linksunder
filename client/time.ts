/**
 * Formats an ISO timestamp for the dashboard's local-time display.
 * Pass a time zone and locale in tests or other deterministic callers.
 */
export function formatTimestamp(value: string, timeZone?: string, locale?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}
