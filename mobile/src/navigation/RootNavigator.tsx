import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { LoadingView } from '../components/ui';
import { theme } from '../theme';
import { RootStackParamList } from './types';
import AppTabs from './AppTabs';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import TenancyDetailScreen from '../screens/home/TenancyDetailScreen';
import NewTenancyScreen from '../screens/home/NewTenancyScreen';
import PropertyFormScreen from '../screens/properties/PropertyFormScreen';
import ApplicationFormScreen from '../screens/discover/ApplicationFormScreen';
import ApplicationsScreen from '../screens/discover/ApplicationsScreen';
import AgreementScreen from '../screens/agreement/AgreementScreen';
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

const Stack = createNativeStackNavigator<RootStackParamList>();

const headerOptions = {
  headerTintColor: theme.colors.primaryDark,
  headerTitleStyle: { fontSize: 18, fontWeight: '800' as const, color: theme.colors.text },
  headerStyle: { backgroundColor: theme.colors.surface },
  headerShadowVisible: false,
  headerTitleAlign: 'center' as const,
};

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView label="Starting…" />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={AppTabs} options={{ animation: 'fade' }} />
          <Stack.Group screenOptions={{ ...headerOptions, headerShown: true }}>
            <Stack.Screen
              name="TenancyDetail"
              component={TenancyDetailScreen}
              options={{ title: 'Tenancy' }}
            />
            <Stack.Screen
              name="NewTenancy"
              component={NewTenancyScreen}
              options={{ title: 'New tenancy' }}
            />
            <Stack.Screen
              name="PropertyForm"
              component={PropertyFormScreen}
              options={({ route }) => ({
                title: route.params?.propertyId ? 'Edit property' : 'New property',
              })}
            />
            <Stack.Screen
              name="ApplicationForm"
              component={ApplicationFormScreen}
              options={{ title: 'Request visit' }}
            />
            <Stack.Screen
              name="Applications"
              component={ApplicationsScreen}
              options={{ title: 'Requests' }}
            />
            <Stack.Screen
              name="Agreement"
              component={AgreementScreen}
              options={{ title: 'Rental agreement' }}
            />
            <Stack.Screen
              name="Inspections"
              component={InspectionsScreen}
              options={{ title: 'Inspections' }}
            />
            <Stack.Screen
              name="InspectionDetail"
              component={InspectionDetailScreen}
              options={{ title: 'Inspection' }}
            />
            <Stack.Screen
              name="NewInspection"
              component={NewInspectionScreen}
              options={{ title: 'New inspection' }}
            />
            <Stack.Screen
              name="Maintenance"
              component={MaintenanceScreen}
              options={{ title: 'Maintenance' }}
            />
            <Stack.Screen
              name="MaintenanceDetail"
              component={MaintenanceDetailScreen}
              options={{ title: 'Maintenance request' }}
            />
            <Stack.Screen
              name="NewMaintenance"
              component={NewMaintenanceScreen}
              options={{ title: 'Report an issue' }}
            />
            <Stack.Screen
              name="Deductions"
              component={DeductionsScreen}
              options={{ title: 'Deductions' }}
            />
            <Stack.Screen
              name="ClaimDetail"
              component={ClaimDetailScreen}
              options={{ title: 'Deduction claim' }}
            />
            <Stack.Screen
              name="NewClaim"
              component={NewClaimScreen}
              options={{ title: 'Propose deduction' }}
            />
            <Stack.Screen
              name="Dispute"
              component={DisputeScreen}
              options={{ title: 'Negotiation' }}
            />
            <Stack.Screen
              name="Settlement"
              component={SettlementScreen}
              options={{ title: 'Settlement' }}
            />
            <Stack.Screen name="Audit" component={AuditScreen} options={{ title: 'Audit trail' }} />
          </Stack.Group>
        </>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'slide_from_right' }} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}