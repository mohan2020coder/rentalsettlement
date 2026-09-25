export interface Envelope<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: 'LANDLORD' | 'TENANT';
  profile_photo?: string | null;
  status: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

export interface Property {
  id: string;
  landlord_id: string;
  property_name: string;
  property_type: string;
  address_line1?: string | null;
  address_line2?: string | null;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  furnishing_status?: string | null;
  description?: string | null;
  status: string;
  listed: boolean;
  monthly_rent_minor: number;
  security_deposit_minor: number;
  currency: string;
  photo?: string | null;
  photos?: string[];
  created_at: string;
}

export interface UploadRef {
  file_path: string;
  mime_type: string;
  size: number;
}

export interface Listing {
  id: string;
  property_name: string;
  property_type: string;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  furnishing_status?: string | null;
  description?: string | null;
  monthly_rent_minor: number;
  security_deposit_minor: number;
  currency: string;
  photo?: string | null;
  photos?: string[];
  created_at: string;
}

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface Application {
  id: string;
  property_id: string;
  property_name: string;
  locality?: string | null;
  city?: string | null;
  monthly_rent_minor: number;
  currency: string;
  tenant_id: string;
  tenant_name: string;
  tenant_email: string;
  landlord_id: string;
  landlord_name: string;
  status: ApplicationStatus;
  preferred_date?: string | null;
  note?: string | null;
  created_at: string;
}

export interface Tenancy {
  id: string;
  property_id: string;
  property_name?: string;
  landlord_id: string;
  tenant_id?: string | null;
  invited_email?: string;
  invited_at?: string;
  accepted_at?: string;
  start_date?: string;
  end_date?: string;
  monthly_rent_minor: number;
  security_deposit_minor: number;
  currency: string;
  notice_period_days: number;
  rent_due_day?: number;
  agreement_reference?: string;
  status: string;
  created_at: string;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  price_minor: number;
  price_formatted: string;
  currency: string;
  billing_interval: string;
  max_properties: number;
  max_active_tenancies: number;
  max_storage_mb: number;
  features: Record<string, unknown> | null;
  is_active: boolean;
}

export interface Subscription {
  id: string;
  plan: Plan;
  status: string;
  started_at: string;
  expires_at?: string | null;
  provider?: string;
  renewable: boolean;
}

export interface Usage {
  property_count: number;
  active_tenancy_count: number;
  storage_bytes: number;
}

export interface AgreementTerms {
  notice_period_days: number;
  monthly_rent_minor: number;
  security_deposit_minor: number;
  currency: string;
  monthly_payment_day: number;
  rent_due_date?: string;
  late_fee_minor: number;
  utility_inclusions: string[];
  clauses: string[];
}

export interface AgreementVersion {
  id: string;
  tenancy_id: string;
  version_number: number;
  terms: AgreementTerms;
  created_by: string;
  landlord_confirmed_at?: string | null;
  tenant_confirmed_at?: string | null;
  fully_confirmed: boolean;
  created_at: string;
}

export interface InspectionSummary {
  id: string;
  tenancy_id: string;
  kind: 'MOVE_IN' | 'MOVE_OUT';
  status: string;
  conducted_by?: string | null;
  created_by: string;
  created_at: string;
}

export interface InspectionMedia {
  id: string;
  inspection_id: string;
  room_id?: string | null;
  item_id?: string | null;
  uploaded_by: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  captured_at?: string | null;
  uploaded_at: string;
}

export interface InspectionItem {
  id: string;
  room_id: string;
  name: string;
  condition?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionRoom {
  id: string;
  inspection_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  items: InspectionItem[];
}

export interface Inspection {
  id: string;
  tenancy_id: string;
  kind: 'MOVE_IN' | 'MOVE_OUT';
  status: 'DRAFT' | 'PENDING_CONFIRMATION' | 'CONFIRMED';
  conducted_at?: string | null;
  conducted_by?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  rooms: InspectionRoom[];
  media: InspectionMedia[];
  confirmed_by: string[];
}

export interface MaintenanceMedia {
  id: string;
  maintenance_request_id: string;
  uploaded_by: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  uploaded_at: string;
}

export interface MaintenanceRequest {
  id: string;
  tenancy_id: string;
  reported_by: string;
  title: string;
  description?: string | null;
  category: string;
  priority: string;
  status: string;
  reported_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  created_at: string;
  updated_at: string;
  media?: MaintenanceMedia[];
}

export interface MaintenanceComment {
  id: string;
  maintenance_request_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface MaintenanceHistory {
  id: string;
  maintenance_request_id: string;
  previous_status: string;
  new_status: string;
  changed_by: string;
  comment?: string | null;
  created_at: string;
}

export type ClaimStatus =
  | 'PROPOSED'
  | 'ACCEPTED'
  | 'DISPUTED'
  | 'COUNTER_OFFERED'
  | 'AGREED'
  | 'WITHDRAWN';

export interface DeductionClaim {
  id: string;
  tenancy_id: string;
  created_by: string;
  category: string;
  title: string;
  description?: string | null;
  claimed_amount_minor: number;
  currency: string;
  status: ClaimStatus;
  created_at: string;
  updated_at: string;
  evidence?: ClaimEvidence[];
}

export interface ClaimEvidence {
  id: string;
  claim_id: string;
  uploaded_by: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  uploaded_at: string;
}

export type DisputeStatus = 'OPEN' | 'NEGOTIATING' | 'AGREED' | 'UNRESOLVED' | 'CLOSED';

export interface Dispute {
  id: string;
  tenancy_id: string;
  deduction_claim_id: string;
  opened_by: string;
  category?: string | null;
  description?: string | null;
  status: DisputeStatus;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

export interface DisputeEvent {
  id: string;
  dispute_id: string;
  actor_id: string;
  action: string;
  original_amount_minor?: number | null;
  new_amount_minor?: number | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface SettlementItem {
  id: string;
  settlement_id: string;
  deduction_claim_id?: string | null;
  category: string;
  title: string;
  amount_minor: number;
  created_at: string;
}

export interface SettlementEvent {
  id: string;
  settlement_id: string;
  actor_id: string;
  action: string;
  amount_minor?: number | null;
  notes?: string | null;
  created_at: string;
}

export interface Settlement {
  id: string;
  tenancy_id: string;
  status: 'DRAFT' | 'PENDING_CONFIRMATION' | 'CONFIRMED';
  version_number: number;
  recorded_deposit_minor: number;
  total_deduction_minor: number;
  remaining_amount_minor: number;
  currency: string;
  proposed_by?: string | null;
  landlord_confirmed_at?: string | null;
  tenant_confirmed_at?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: SettlementItem[];
  events?: SettlementEvent[];
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string;
  entity_id?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id?: string | null;
  tenancy_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

// ---- Request payloads ----

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: 'LANDLORD' | 'TENANT';
}

export interface CreatePropertyPayload {
  property_name: string;
  property_type: string;
  address_line1?: string;
  address_line2?: string;
  locality?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  bedrooms?: number;
  bathrooms?: number;
  furnishing_status?: string;
  description?: string;
  monthly_rent_minor?: number;
  security_deposit_minor?: number;
  currency?: string;
  listed?: boolean;
  photo?: string | null;
  photos?: string[];
}

export interface CreateApplicationPayload {
  property_id: string;
  preferred_date?: string;
  note?: string;
}

export interface CreateTenancyPayload {
  property_id: string;
  invited_email: string;
  start_date?: string;
  end_date?: string;
  monthly_rent_minor: number;
  security_deposit_minor: number;
  currency: string;
  notice_period_days: number;
  rent_due_day?: number;
  agreement_reference?: string;
}

export interface CreateAgreementPayload {
  notice_period_days: number;
  monthly_rent_minor: number;
  security_deposit_minor: number;
  currency: string;
  monthly_payment_day: number;
  late_fee_minor: number;
  utility_inclusions: string[];
  clauses: string[];
}

export interface CreateInspectionPayload {
  notes?: string;
  rooms?: string[];
  exclude_rooms?: string[];
}

export interface InspectionTemplateRoom {
  name: string;
  items: string[];
}

export interface InspectionTemplate {
  property_name: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  furnishing_status: string;
  kind: 'MOVE_IN' | 'MOVE_OUT';
  reused_from_move_in: boolean;
  rooms: InspectionTemplateRoom[];
}

export interface SaveItemPayload {
  condition: string;
  notes?: string;
}

export interface ReportMaintenancePayload {
  title: string;
  description?: string;
  category: string;
  priority: string;
}

export interface ProposeClaimPayload {
  category: string;
  title: string;
  description?: string;
  claimed_amount_minor: number;
  currency: string;
}

export interface DisputePayload {
  category?: string;
  reason: string;
}

export interface CounterOfferPayload {
  new_amount_minor: number;
  reason?: string;
}

export interface GenerateSettlementPayload {
  recorded_deposit_minor?: number;
  currency?: string;
}