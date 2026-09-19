/** Formats a minor-unit amount (e.g. 3000000 minor = ₹30,000.00). */
export function formatMoney(amountMinor: number, currency = 'INR'): string {
  const major = (amountMinor ?? 0) / 100;
  const symbol = currencySymbol(currency);
  const fixed = major.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${fixed}`;
}

/** Compact money, no decimals for whole majors (e.g. ₹30,000). */
export function formatMoneyCompact(amountMinor: number, currency = 'INR'): string {
  const major = (amountMinor ?? 0) / 100;
  const symbol = currencySymbol(currency);
  if (Number.isInteger(major)) {
    return `${symbol}${major.toLocaleString('en-IN')}`;
  }
  return formatMoney(amountMinor, currency);
}

/** Parses a user-typed amount like "30000" or "30000.50" into minor units. */
export function parseAmountMinor(input: string): number | null {
  const cleaned = input.replace(/[^\d.]/g, '');
  const value = Number(cleaned);
  if (Number.isNaN(value) || value < 0) {
    return null;
  }
  return Math.round(value * 100);
}

function currencySymbol(currency: string): string {
  switch ((currency || 'INR').toUpperCase()) {
    case 'INR':
      return '₹';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return `${currency} `;
  }
}

/** Formats a date-time string for display. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Formats a date-time (with time) for display. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function titleCase(phrase: string): string {
  return phrase
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}