import React from 'react';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { theme } from '../theme';
import type {
  HomeStackParamList,
  DiscoverStackParamList,
  PropertiesStackParamList,
} from './types';
import HomeScreen from '../screens/home/HomeScreen';
import TenancyDetailScreen from '../screens/home/TenancyDetailScreen';
import NewTenancyScreen from '../screens/home/NewTenancyScreen';
import AgreementScreen from '../screens/agreement/AgreementScreen';
import NewAgreementVersionScreen from '../screens/agreement/NewAgreementVersionScreen';
import InspectionsScreen from '../screens/inspections/InspectionsScreen';
import InspectionDetailScreen from '../screens/inspections/InspectionDetailScreen';
import NewInspectionScreen from '../screens/inspections/NewInspectionScreen';
import MaintenanceScreen from '../screens/maintenance/MaintenanceScreen';
import MaintenanceDetailScreen from '../screens/maintenance/MaintenanceDetailScreen';
import NewMaintenanceScreen from '../screens/maintenance/NewMaintenanceScreen';
import DeductionsScreen from '../screens/deductions/DeductionsScreen';
import ClaimDetailScreen from '../screens/deductions/ClaimDetailScreen';
import NewClaimScreen from '../screens/deductions/NewClaimScreen';
import DisputeScreen from '../screens/deductions/DisputeScreen';
import SettlementScreen from '../screens/settlement/SettlementScreen';
import AuditScreen from '../screens/audit/AuditScreen';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import PropertyDetailScreen from '../screens/properties/PropertyDetailScreen';
import PropertyFormScreen from '../screens/properties/PropertyFormScreen';
import ApplicationFormScreen from '../screens/discover/ApplicationFormScreen';
import ApplicationsScreen from '../screens/discover/ApplicationsScreen';
import PropertiesScreen from '../screens/properties/PropertiesScreen';

const headerOptions: NativeStackNavigationOptions = {
  headerTintColor: theme.colors.primaryDark,
  headerTitleStyle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  headerStyle: { backgroundColor: theme.colors.surface },
  headerShadowVisible: false,
  headerTitleAlign: 'center',
};

function stackScreenOptions(
  root: string,
): NativeStackNavigationOptions | ((props: { route: { name: string } }) => NativeStackNavigationOptions) {
  return ({ route }) => ({
    headerShown: route.name !== root,
    ...headerOptions,
  });
}

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();
const PropertiesStack = createNativeStackNavigator<PropertiesStackParamList>();

export function HomeTabStack() {
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions('HomeRoot')}>
      <HomeStack.Screen name="HomeRoot" component={HomeScreen} />
      <HomeStack.Screen name="TenancyDetail" component={TenancyDetailScreen} options={{ title: 'Tenancy' }} />
      <HomeStack.Screen name="NewTenancy" component={NewTenancyScreen} options={{ title: 'New tenancy' }} />
      <HomeStack.Screen name="Agreement" component={AgreementScreen} options={{ title: 'Rental agreement' }} />
      <HomeStack.Screen name="NewAgreementVersion" component={NewAgreementVersionScreen} options={{ title: 'Renew terms' }} />
      <HomeStack.Screen name="Inspections" component={InspectionsScreen} options={{ title: 'Inspections' }} />
      <HomeStack.Screen name="InspectionDetail" component={InspectionDetailScreen} options={{ title: 'Inspection' }} />
      <HomeStack.Screen name="NewInspection" component={NewInspectionScreen} options={{ title: 'New inspection' }} />
      <HomeStack.Screen name="Maintenance" component={MaintenanceScreen} options={{ title: 'Maintenance' }} />
      <HomeStack.Screen name="MaintenanceDetail" component={MaintenanceDetailScreen} options={{ title: 'Maintenance request' }} />
      <HomeStack.Screen name="NewMaintenance" component={NewMaintenanceScreen} options={{ title: 'Report an issue' }} />
      <HomeStack.Screen name="Deductions" component={DeductionsScreen} options={{ title: 'Deductions' }} />
      <HomeStack.Screen name="ClaimDetail" component={ClaimDetailScreen} options={{ title: 'Deduction claim' }} />
      <HomeStack.Screen name="NewClaim" component={NewClaimScreen} options={{ title: 'Propose deduction' }} />
      <HomeStack.Screen name="Dispute" component={DisputeScreen} options={{ title: 'Negotiation' }} />
      <HomeStack.Screen name="Settlement" component={SettlementScreen} options={{ title: 'Settlement' }} />
      <HomeStack.Screen name="Audit" component={AuditScreen} options={{ title: 'Audit trail' }} />
    </HomeStack.Navigator>
  );
}

export function DiscoverTabStack() {
  return (
    <DiscoverStack.Navigator screenOptions={stackScreenOptions('DiscoverRoot')}>
      <DiscoverStack.Screen name="DiscoverRoot" component={DiscoverScreen} />
      <DiscoverStack.Screen name="PropertyDetail" component={PropertyDetailScreen} options={{ title: 'Property' }} />
      <DiscoverStack.Screen
        name="PropertyForm"
        component={PropertyFormScreen}
        options={({ route }) => ({ title: route.params?.propertyId ? 'Edit property' : 'New property' })}
      />
      <DiscoverStack.Screen name="ApplicationForm" component={ApplicationFormScreen} options={{ title: 'Request visit' }} />
      <DiscoverStack.Screen name="Applications" component={ApplicationsScreen} options={{ title: 'Requests' }} />
    </DiscoverStack.Navigator>
  );
}

export function PropertiesTabStack() {
  return (
    <PropertiesStack.Navigator screenOptions={stackScreenOptions('PropertiesRoot')}>
      <PropertiesStack.Screen name="PropertiesRoot" component={PropertiesScreen} />
      <PropertiesStack.Screen name="PropertyDetail" component={PropertyDetailScreen} options={{ title: 'Property' }} />
      <PropertiesStack.Screen
        name="PropertyForm"
        component={PropertyFormScreen}
        options={({ route }) => ({ title: route.params?.propertyId ? 'Edit property' : 'New property' })}
      />
      <PropertiesStack.Screen name="Applications" component={ApplicationsScreen} options={{ title: 'Requests' }} />
    </PropertiesStack.Navigator>
  );
}