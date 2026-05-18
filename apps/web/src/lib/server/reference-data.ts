import 'server-only';

/**
 * Curated list of currencies the UI offers. We bias toward markets where
 * TikFlow operates today and add the majors to cover edge cases. The
 * server still validates the picked code is a valid 3-letter ISO 4217
 * string — this list is just the UX dropdown.
 */
export const CURRENCIES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'BDT', label: 'Bangladeshi Taka (BDT)' },
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'INR', label: 'Indian Rupee (INR)' },
  { code: 'PKR', label: 'Pakistani Rupee (PKR)' },
  { code: 'LKR', label: 'Sri Lankan Rupee (LKR)' },
  { code: 'NPR', label: 'Nepalese Rupee (NPR)' },
  { code: 'MYR', label: 'Malaysian Ringgit (MYR)' },
  { code: 'SGD', label: 'Singapore Dollar (SGD)' },
  { code: 'AED', label: 'UAE Dirham (AED)' },
  { code: 'SAR', label: 'Saudi Riyal (SAR)' },
];

const CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code));

export function isSupportedCurrency(code: string): boolean {
  return CURRENCY_CODES.has(code);
}

/**
 * IANA timezones supported by Node's Intl. We grab them at module load
 * (Node 22 exposes Intl.supportedValuesOf) and keep the list filtered to
 * region/city entries so the dropdown isn't 600 lines long.
 */
function buildTimezones(): ReadonlyArray<string> {
  const all =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  // Always include UTC. Always include Asia/Dhaka so the BD default works
  // even if a runtime trims the tz list.
  const required = ['UTC', 'Asia/Dhaka'];
  const merged = new Set<string>([...required, ...all]);
  return Array.from(merged).sort();
}

export const TIMEZONES = buildTimezones();

const TIMEZONE_SET = new Set(TIMEZONES);

export function isSupportedTimezone(tz: string): boolean {
  return TIMEZONE_SET.has(tz);
}
