export const currencySymbol = (currency: string): string => {
  switch ((currency || '').toUpperCase()) {
    case 'INR':
      return '\u20B9';
    case 'USD':
      return '$';
    case 'EUR':
      return '\u20AC';
    case 'GBP':
      return '\u00A3';
    default:
      return currency ? `${currency} ` : '';
  }
};

export function formatMoney(minor: number, currency = 'INR'): string {
  const symbol = currencySymbol(currency);
  const rupees = (minor ?? 0) / 100;
  const formatted = rupees.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  });
  return `${symbol}${formatted}`;
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function timeAgo(value?: string | null): string {
  if (!value) {
    return '';
  }
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function humanize(status: string): string {
  const s = (status || '').replace(/_/g, ' ');
  return s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export const CONDITION_COLORS: Record<string, string> = {
  EXCELLENT: '#15803d',
  GOOD: '#3f6212',
  FAIR: '#b45309',
  DAMAGED: '#b91c1c',
  NOT_PRESENT: '#64748b',
};

export const STATUS_COLORS: Record<string, string> = {
  INVITED: '#7c3aed',
  ACTIVE: '#15803d',
  NOTICE_GIVEN: '#b45309',
  MOVE_OUT: '#b91c1c',
  SETTLED: '#0f766e',
  CANCELLED: '#64748b',
  DRAFT: '#64748b',
  PENDING_CONFIRMATION: '#b45309',
  CONFIRMED: '#15803d',
  PENDING: '#b45309',
  APPROVED: '#15803d',
  PROPOSED: '#1d4ed8',
  ACCEPTED: '#0f766e',
  DISPUTED: '#b45309',
  COUNTER_OFFERED: '#7c3aed',
  AGREED: '#15803d',
  WITHDRAWN: '#64748b',
  OPEN: '#b91c1c',
  ACKNOWLEDGED: '#b45309',
  IN_PROGRESS: '#1d4ed8',
  RESOLVED: '#15803d',
  REJECTED: '#64748b',
  NEGOTIATING: '#7c3aed',
  UNRESOLVED: '#64748b',
  CLOSED: '#64748b',
};

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#64748b';
}