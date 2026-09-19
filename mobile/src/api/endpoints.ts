import { api } from './client';

import {
  AgreementVersion,
  AppNotification,
  AuditLog,
  AuthResponse,
  CreateTenancyRequest,
  DeductionClaim,
  Dispute,
  DisputeEvent,
  Inspection,
  MaintenanceComment,
  MaintenanceRequest,
  MediaMeta,
  Plan,
  Property,
  PropertyRequest,
  Settlement,
  Subscription,
  Tenancy,
  Terms,
  Usage,
  User,
} from '../types';

// ---- auth ------------------------------------------------------------------

export interface AuthPayload {
  name?: string;
  email: string;
  password: string;
  role?: 'LANDLORD' | 'TENANT';
  phone?: string;
}

export const authApi = {
  register: (payload: AuthPayload) =>
    api.request<AuthResponse>('/auth/register', { method: 'POST', body: payload }),
  login: (payload: { email: string; password: string }) =>
    api.request<AuthResponse>('/auth/login', { method: 'POST', body: payload }),
  refresh: (refreshToken: string) =>
    api.request<{ access_token: string; refresh_token: string; expires_in: number }>('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
    }),
  logout: (refreshToken: string) =>
    api.request('/auth/logout', { method: 'POST', body: { refresh_token: refreshToken } }),
};

// ---- users -----------------------------------------------------------------

export const usersApi = {
  me: () => api.request<User>('/users/me'),
  updateProfile: (payload: { name?: string; phone?: string }) =>
    api.request<User>('/users/me', { method: 'PATCH', body: payload }),
};

// ---- billing ---------------------------------------------------------------

export const billingApi = {
  plans: () => api.request<Plan[]>('/billing/plans'),
  subscription: () => api.request<Subscription>('/billing/subscription'),
  usage: () => api.request<Usage>('/billing/usage'),
  changePlan: (planCode: string) =>
    api.request<Subscription>('/billing/change-plan', { method: 'POST', body: { plan_code: planCode } }),
};

// ---- properties ------------------------------------------------------------

export const propertiesApi = {
  list: () => api.request<Property[]>('/properties'),
  get: (id: string) => api.request<Property>(`/properties/${id}`),
  create: (payload: PropertyRequest) =>
    api.request<Property>('/properties', { method: 'POST', body: payload }),
  update: (id: string, payload: Partial<PropertyRequest>) =>
    api.request<Property>(`/properties/${id}`, { method: 'PATCH', body: payload }),
};

// ---- tenancies -------------------------------------------------------------

export const tenanciesApi = {
  list: () => api.request<Tenancy[]>('/tenancies'),
  get: (id: string) => api.request<Tenancy>(`/tenancies/${id}`),
  create: (payload: CreateTenancyRequest) =>
    api.request<Tenancy>('/tenancies', { method: 'POST', body: payload }),
  regenerateInvite: (id: string) =>
    api.request<Tenancy>(`/tenancies/${id}/invite`, { method: 'POST', body: {} }),
  accept: (id: string, inviteToken: string) =>
    api.request<Tenancy>(`/tenancies/${id}/accept`, { method: 'POST', body: { invite_token: inviteToken } }),
  updateStatus: (id: string, status: string) =>
    api.request<Tenancy>(`/tenancies/${id}/status`, { method: 'POST', body: { status } }),
};

// ---- agreements ------------------------------------------------------------

export const agreementsApi = {
  current: (tenancyId: string) => api.request<AgreementVersion>(`/agreements/tenancy/${tenancyId}/current`),
  versions: (tenancyId: string) => api.request<AgreementVersion[]>(`/agreements/tenancy/${tenancyId}/versions`),
  create: (tenancyId: string, terms: Terms) =>
    api.request<AgreementVersion>(`/agreements/tenancy/${tenancyId}/versions`, { method: 'POST', body: terms }),
  approve: (tenancyId: string, version: number) =>
    api.request<AgreementVersion>(`/agreements/tenancy/${tenancyId}/versions/${version}/approve`, {
      method: 'POST',
      body: {},
    }),
};

// ---- inspections -----------------------------------------------------------

export const inspectionsApi = {
  list: (tenancyId: string) => api.request<Inspection[]>(`/inspections/tenancy/${tenancyId}`),
  get: (id: string) => api.request<Inspection>(`/inspections/${id}`),
  createMoveIn: (tenancyId: string, notes?: string) =>
    api.request<Inspection>(`/inspections/tenancy/${tenancyId}/move-in`, { method: 'POST', body: { notes } }),
  createMoveOut: (tenancyId: string, notes?: string) =>
    api.request<Inspection>(`/inspections/tenancy/${tenancyId}/move-out`, { method: 'POST', body: { notes } }),
  saveItem: (
    inspectionId: string,
    roomId: string,
    itemId: string,
    payload: { condition: string; notes?: string },
  ) =>
    api.request<Inspection>(`/inspections/${inspectionId}/rooms/${roomId}/items/${itemId}`, {
      method: 'PUT',
      body: payload,
    }),
  addMedia: (
    inspectionId: string,
    payload: { file_path: string; mime_type: string; file_size: number; sha256_hash: string },
  ) => api.request<MediaMeta>(`/inspections/${inspectionId}/media`, { method: 'POST', body: payload }),
  confirm: (inspectionId: string) =>
    api.request<Inspection>(`/inspections/${inspectionId}/confirm`, { method: 'POST', body: {} }),
};

// ---- maintenance -----------------------------------------------------------

export interface ReportMaintenancePayload {
  title: string;
  description?: string;
  category: string;
  priority: string;
}

export const maintenanceApi = {
  list: (tenancyId: string) => api.request<MaintenanceRequest[]>(`/maintenance/tenancy/${tenancyId}`),
  get: (id: string) => api.request<MaintenanceRequest>(`/maintenance/${id}`),
  report: (tenancyId: string, payload: ReportMaintenancePayload) =>
    api.request<MaintenanceRequest>(`/maintenance/tenancy/${tenancyId}`, { method: 'POST', body: payload }),
  comments: (id: string) => api.request<MaintenanceComment[]>(`/maintenance/${id}/comments`),
  addComment: (id: string, body: string) =>
    api.request<MaintenanceComment>(`/maintenance/${id}/comments`, { method: 'POST', body: { body } }),
  addMedia: (id: string, payload: { file_path: string; mime_type: string; file_size: number; sha256_hash: string }) =>
    api.request<MediaMeta>(`/maintenance/${id}/media`, { method: 'POST', body: payload }),
  updateStatus: (id: string, status: string, comment?: string) =>
    api.request<MaintenanceRequest>(`/maintenance/${id}/status`, { method: 'POST', body: { status, comment } }),
};

// ---- deductions & disputes -------------------------------------------------

export const deductionsApi = {
  list: (tenancyId: string) => api.request<DeductionClaim[]>(`/deductions/tenancy/${tenancyId}`),
  get: (id: string) => api.request<DeductionClaim>(`/deductions/${id}`),
  propose: (
    tenancyId: string,
    payload: { category: string; title: string; description?: string; claimed_amount_minor: number; currency: string },
  ) => api.request<DeductionClaim>(`/deductions/tenancy/${tenancyId}`, { method: 'POST', body: payload }),
  withdraw: (id: string) => api.request<DeductionClaim>(`/deductions/${id}/withdraw`, { method: 'POST', body: {} }),
  accept: (id: string) => api.request<DeductionClaim>(`/deductions/${id}/accept`, { method: 'POST', body: {} }),
  dispute: (id: string, reason: string) =>
    api.request<Dispute>(`/deductions/${id}/dispute`, { method: 'POST', body: { reason } }),
};

export const disputesApi = {
  list: (tenancyId: string) => api.request<Dispute[]>(`/disputes/tenancy/${tenancyId}`),
  get: (id: string) => api.request<Dispute & { events?: DisputeEvent[] }>(`/disputes/${id}`),
  accept: (id: string) => api.request<DeductionClaim>(`/disputes/${id}/accept`, { method: 'POST', body: {} }),
  counterOffer: (id: string, newAmountMinor: number, reason?: string) =>
    api.request<Dispute>(`/disputes/${id}/counter-offer`, {
      method: 'POST',
      body: { new_amount_minor: newAmountMinor, reason },
    }),
  withdraw: (id: string) => api.request<Dispute>(`/disputes/${id}/withdraw`, { method: 'POST', body: {} }),
};

// ---- settlements -----------------------------------------------------------

export const settlementsApi = {
  get: (tenancyId: string) => api.request<Settlement>(`/settlements/tenancy/${tenancyId}`),
  generate: (tenancyId: string, payload?: { recorded_deposit_minor?: number; currency?: string }) =>
    api.request<Settlement>(`/settlements/tenancy/${tenancyId}`, { method: 'POST', body: payload ?? {} }),
  confirm: (tenancyId: string) =>
    api.request<Settlement>(`/settlements/tenancy/${tenancyId}/confirm`, { method: 'POST', body: {} }),
};

// ---- notifications ---------------------------------------------------------

export const notificationsApi = {
  list: () => api.request<AppNotification[]>('/notifications'),
  unreadCount: () => api.request<{ unread_count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.request<{ status: string }>(`/notifications/${id}/read`, { method: 'POST', body: {} }),
  markAllRead: () => api.request<{ status: string }>('/notifications/read-all', { method: 'POST', body: {} }),
};

// ---- audit -----------------------------------------------------------------

export const auditApi = {
  me: () => api.request<AuditLog[]>('/audit/me'),
  tenancy: (tenancyId: string) => api.request<AuditLog[]>(`/audit/tenancy/${tenancyId}`),
};

// ---- evidence --------------------------------------------------------------

export const evidenceApi = {
  download: (tenancyId: string) => api.download(`/evidence/tenancy/${tenancyId}/download`),
};