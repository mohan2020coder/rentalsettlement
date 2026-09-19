import { titleCase } from './format';

export interface StatusColor {
  bg: string;
  fg: string;
}

/** Neutral palette used across status badges. */
const PALETTE: Record<string, StatusColor> = {
  slate: { bg: '#eef2f6', fg: '#475569' },
  blue: { bg: '#e0ecff', fg: '#1d4ed8' },
  green: { bg: '#dcfce7', fg: '#15803d' },
  amber: { bg: '#fef3c7', fg: '#b45309' },
  red: { bg: '#fee2e2', fg: '#b91c1c' },
  violet: { bg: '#ede9fe', fg: '#6d28d9' },
  pink: { bg: '#fce7f3', fg: '#be185d' },
};

export function statusColor(status: string): StatusColor {
  switch ((status || '').toUpperCase()) {
    case 'ACTIVE':
    case 'CONFIRMED':
    case 'AGREED':
    case 'ACCEPTED':
    case 'RESOLVED':
    case 'SETTLED':
      return PALETTE.green;
    case 'INVITED':
    case 'DRAFT':
    case 'PROPOSED':
    case 'OPEN':
    case 'PENDING_CONFIRMATION':
    case 'ACKNOWLEDGED':
    case 'IN_PROGRESS':
      return PALETTE.blue;
    case 'NOTICE_GIVEN':
    case 'MOVE_OUT':
    case 'DISPUTED':
    case 'NEGOTIATING':
    case 'COUNTER_OFFERED':
    case 'PENDING':
      return PALETTE.amber;
    case 'CANCELLED':
    case 'REJECTED':
    case 'WITHDRAWN':
    case 'DISABLED':
    case 'EXPIRED':
      return PALETTE.red;
    case 'UNRESOLVED':
    case 'CLOSED':
      return PALETTE.slate;
    default:
      return PALETTE.slate;
  }
}

export function statusLabel(status: string): string {
  return titleCase(status ?? '');
}

/** Human label for inspection kinds. */
export function inspectionKindLabel(kind: string): string {
  return kind === 'MOVE_IN' ? 'Move-in' : 'Move-out';
}

/** Human label for claim categories. */
export function claimCategoryLabel(category: string): string {
  switch ((category || '').toUpperCase()) {
    case 'UNPAID_RENT':
      return 'Unpaid rent';
    case 'UTILITY':
      return 'Utilities';
    case 'PROPERTY_DAMAGE':
      return 'Property damage';
    case 'MISSING_ITEM':
      return 'Missing item';
    case 'CLEANING':
      return 'Cleaning';
    default:
      return titleCase(category);
  }
}

export const MAINTENANCE_CATEGORIES = ['PLUMBING', 'ELECTRICAL', 'APPLIANCE', 'STRUCTURAL', 'CLEANING', 'OTHER'];
export const MAINTENANCE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const CLAIM_CATEGORIES = ['UNPAID_RENT', 'UTILITY', 'PROPERTY_DAMAGE', 'MISSING_ITEM', 'CLEANING', 'OTHER'];
export const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'NOT_PRESENT'];