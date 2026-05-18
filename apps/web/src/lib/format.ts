/**
 * Locale-aware datetime formatter. Safe to call from both server and
 * client components — uses the platform's Intl.
 *
 * Accepts ISO strings (what we serialise dates as across the
 * server-action boundary) or Date instances (RSC render path).
 */
export function formatDateTime(
  value: string | Date | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  },
): string {
  if (value === null || value === undefined) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, options).format(date);
}
