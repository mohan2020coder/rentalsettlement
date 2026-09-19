// Types mirror the backend JSON DTOs (see docs/api.md and internal/*/dto.go).

export type Role = 'LANDLORD' | 'TENANT';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  profile_photo: string | null;
  status: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

export interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ---- billing ---------------------------------------------------------------

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
  features: Record<string, boolean>;
  is_active: boolean;
}

export interface Subscription {
  id: string;
  plan: Plan;
  status: string;
  started_at: string;
  expires_at: string | null;
  provider: string;
  renewable: boolean;
}

export interface Usage {
  property_count: number;
  active_tenancy_count: number;
  storage_bytes: number;
}

// ---- properties ------------------------------------------------------------

export type PropertyType = 'APARTMENT' | 'HOUSE' | 'VILLA' | 'PG' | 'OTHER';
export type Furnishing = 'FURNISHED' | 'SEMI_FURNISHED' | 'UNFURNISHED';

export interface Property {
  id: string;
  landlord_id: string;
  property_name: string;
  property_type: PropertyType;
  address_line1?: string | null;
  address_line2?: string | null;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  furnishing_status?: Furnishing | null;
  description?: string | null;
  status: string;
  created_at: string;
}

export interface PropertyRequest {
  property_name: string;
  property_type: PropertyType;
  address_line1?: string;
  address_line2?: string;
  locality?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  bedrooms?: number;
  bathrooms?: number;
  furnishing_status?: Furnishing;
  description?: string;
}

// ---- tenancies -------------------------------------------------------------

export type TenancyStatus =
  | 'INVITED'
  | 'ACTIVE'
  | 'NOTICE_GIVEN'
  | 'MOVE_OUT'
  | 'SETTLED'
  | 'CANCELLED';

export interface Tenancy {
  id: string;
  property_id: string;
  landlord_id: string;
  tenant_id: string | null;
  invited_email?: string | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  monthly_rent_minor: number;
  security_deposit_minor: number;
  currency: string;
  notice_period_days: number;
  rent_due_day?: number | null;
  agreement_reference?: string | null;
  status: TenancyStatus;
  created_at: string;
}

export interface CreateTenancyRequest {
  property_id: string;
  invited_email: string;
  start_date: string;
  end_date: string;
  monthly_rent_minor: number;
  security_deposit_minor: number;
  currency: string;
  notice_period_days: number;
  rent_due_day?: number;
  agreement_reference?: string;
}

// ---- agreements ------------------------------------------------------------

export interface Terms {
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
  terms: Terms;
  created_by: string;
  landlord_confirmed_at?: string | null;
  tenant_confirmed_at?: string | null;
  fully_confirmed: boolean;
  created_at: string;
}

// ---- inspections -----------------------------------------------------------

export type InspectionKind = 'MOVE_IN' | 'MOVE_OUT';
export type InspectionStatus = 'DRAFT' | 'PENDING_CONFIRMATION' | 'CONFIRMED';
export type Condition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'NOT_PRESENT';

export interface InspectionItem {
  id: string;
  room_id: string;
  name: string;
  condition: Condition | null;
  notes?: string | null;
}

export interface InspectionRoom {
  id: string;
  inspection_id: string;
  name: string;
  sort_order: number;
  items: InspectionItem[];
}

export interface InspectionMedia {
  id: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  captured_at?: string | null;
}

export interface Inspection {
  id: string;
  tenancy_id: string;
  kind: InspectionKind;
  status: InspectionStatus;
  conducted_at?: string | null;
  conducted_by?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
  rooms?: InspectionRoom[];
  media?: InspectionMedia[];
  confirmed_by?: string[];
}

// ---- maintenance -----------------------------------------------------------

export type MaintenanceStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'REJECTED';

export interface MaintenanceRequest {
  id: string;
  tenancy_id: string;
  reported_by: string;
  title: string;
  description?: string | null;
  category: string;
  priority: string;
  status: MaintenanceStatus;
  reported_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  created_at: string;
  media?: MediaMeta[];
}

export interface MediaMeta {
  id: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
}

export interface HistoryEntry {
  id: string;
  maintenance_request_id: string;
  previous_status: string;
  new_status: string;
  changed_by: string;
  comment?: string | null;
  created_at: string;
}

export interface MaintenanceComment {
  id: string;
  maintenance_request_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

// ---- deductions & disputes -------------------------------------------------

export type ClaimStatus =
  | 'PROPOSED'
  | 'ACCEPTED'
  | 'DISPUTED'
  | 'COUNTER_OFFERED'
  | 'AGREED'
  | 'WITHDRAWN';

export type DisputeStatus =
  | 'OPEN'
  | 'NEGOTIATING'
  | 'AGREED'
  | 'UNRESOLVED'
  | 'CLOSED';

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
}

export interface DisputeEvent {
  id: string;
  dispute_id: string;
  actor_id: string;
  action: string;
  original_amount_minor?: number | null;
  new_amount_minor?: number | null;
  reason?: string | null;
  created_at: string;
}

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

// ---- settlements -----------------------------------------------------------

export type SettlementStatus = 'DRAFT' | 'PENDING_CONFIRMATION' | 'CONFIRMED';

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
  status: SettlementStatus;
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

// ---- notifications ---------------------------------------------------------

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

// ---- audit -----------------------------------------------------------------

export interface AuditLog {
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