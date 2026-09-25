import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Property } from '../api/types';

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type HomeStackParamList = {
  HomeRoot: undefined;
  TenancyDetail: { tenancyId: string; propertyName?: string };
  NewTenancy: undefined;
  Agreement: { tenancyId: string };
  NewAgreementVersion: { tenancyId: string };
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
  Audit: { tenancyId?: string };
};

export type DiscoverStackParamList = {
  DiscoverRoot: undefined;
  PropertyDetail: { propertyId: string };
  PropertyForm: { propertyId?: string; initial?: Property };
  ApplicationForm: {
    propertyId: string;
    propertyName: string;
    monthlyRentMinor: number;
    currency: string;
  };
  Applications: undefined;
};

export type PropertiesStackParamList = {
  PropertiesRoot: undefined;
  PropertyDetail: { propertyId: string };
  PropertyForm: { propertyId?: string; initial?: Property };
  Applications: undefined;
};

export type NotificationsStackParamList = {
  Notifications: undefined;
};

export type BillingStackParamList = {
  Billing: undefined;
};

export type AccountStackParamList = {
  Account: undefined;
};

export type TabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Discover: NavigatorScreenParams<DiscoverStackParamList> | undefined;
  Properties: NavigatorScreenParams<PropertiesStackParamList> | undefined;
  Notifications: NavigatorScreenParams<NotificationsStackParamList> | undefined;
  Billing: NavigatorScreenParams<BillingStackParamList> | undefined;
  Account: NavigatorScreenParams<AccountStackParamList> | undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Discover: NavigatorScreenParams<DiscoverStackParamList> | undefined;
  Properties: NavigatorScreenParams<PropertiesStackParamList> | undefined;
  Notifications: NavigatorScreenParams<NotificationsStackParamList> | undefined;
  Billing: NavigatorScreenParams<BillingStackParamList> | undefined;
  Account: NavigatorScreenParams<AccountStackParamList> | undefined;
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
  NewAgreementVersion: { tenancyId: string };
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