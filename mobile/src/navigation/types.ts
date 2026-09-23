import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Property } from '../api/types';

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  TenancyDetail: { tenancyId: string; propertyName?: string };
  NewTenancy: undefined;
  PropertyForm: { propertyId?: string; initial?: Property };
  PropertyDetail: { propertyId: string };
  ApplicationForm: {
    propertyId: string;
    propertyName: string;
    monthlyRentMinor: number;
    currency: string;
  };
  Applications: undefined;
  Agreement: { tenancyId: string };
  Inspections: { tenancyId: string };
  InspectionDetail: { inspectionId: string };
  NewInspection: { tenancyId: string; kind: 'MOVE_IN' | 'MOVE_OUT' };
  Maintenance: { tenancyId: string };
  MaintenanceDetail: { maintenanceId: string };
  NewMaintenance: { tenancyId: string };
  Deductions: { tenancyId: string };
  ClaimDetail: { claimId: string };
  NewClaim: { tenancyId: string };
  Dispute: { disputeId: string };
  Settlement: { tenancyId: string };
  NotificationDetail: { notificationId: string };
  Profile: undefined;
  Audit: { tenancyId?: string };
};

export type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Properties: undefined;
  Notifications: undefined;
  Billing: undefined;
  Account: undefined;
};