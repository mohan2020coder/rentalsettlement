export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
};

export type LandlordStackParamList = {
  Properties: undefined;
  PropertyDetail: { propertyId: string };
  NewProperty: undefined;
  Tenancies: undefined;
  NewTenancy: undefined;
  TenancyDetail: { tenancyId: string };
  Agreement: { tenancyId: string };
  Inspections: { tenancyId: string };
  InspectionDetail: { inspectionId: string };
  Claims: { tenancyId: string };
  ClaimDetail: { claimId: string };
  NewClaim: { tenancyId: string };
  Settlement: { tenancyId: string };
  Maintenance: { tenancyId: string };
  MaintenanceDetail: { requestId: string };
  NewMaintenance: { tenancyId: string };
  Audit: { tenancyId: string };
  Evidence: { tenancyId: string };
};

export type TenantStackParamList = {
  Home: undefined;
  TenancyDetail: { tenancyId: string };
  Agreement: { tenancyId: string };
  Inspections: { tenancyId: string };
  InspectionDetail: { inspectionId: string };
  Claims: { tenancyId: string };
  ClaimDetail: { claimId: string };
  Settlement: { tenancyId: string };
  Maintenance: { tenancyId: string };
  MaintenanceDetail: { requestId: string };
  NewMaintenance: { tenancyId: string };
  Audit: { tenancyId: string };
  Evidence: { tenancyId: string };
};

export type NotificationsTabParams = undefined;

// Shared screen route params extracted from either role stack.
export type TenancyScreenParams = { tenancyId: string };