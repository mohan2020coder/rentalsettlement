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
  EXCELLENT: '#16A36A',
  GOOD: '#16A36A',
  FAIR: '#F4A623',
  DAMAGED: '#E5484D',
  NOT_PRESENT: '#687386',
};

export const STATUS_COLORS: Record<string, string> = {
  INVITED: '#1557C0',
  ACTIVE: '#16A36A',
  NOTICE_GIVEN: '#F4A623',
  MOVE_OUT: '#E5484D',
  SETTLED: '#123B73',
  CANCELLED: '#687386',
  DRAFT: '#1557C0',
  PENDING_CONFIRMATION: '#F4A623',
  CONFIRMED: '#16A36A',
  PENDING: '#F4A623',
  APPROVED: '#16A36A',
  PROPOSED: '#F4A623',
  ACCEPTED: '#16A36A',
  DISPUTED: '#E5484D',
  COUNTER_OFFERED: '#1557C0',
  AGREED: '#16A36A',
  WITHDRAWN: '#687386',
  OPEN: '#F4A623',
  ACKNOWLEDGED: '#F4A623',
  IN_PROGRESS: '#1557C0',
  RESOLVED: '#16A36A',
  REJECTED: '#687386',
  NEGOTIATING: '#1557C0',
  UNRESOLVED: '#687386',
  CLOSED: '#687386',
  INACTIVE: '#687386',
};

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#687386';
}