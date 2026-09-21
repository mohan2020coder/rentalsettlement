import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { theme } from '../theme';
import { TabParamList } from './types';
import HomeScreen from '../screens/home/HomeScreen';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import PropertiesScreen from '../screens/properties/PropertiesScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import BillingScreen from '../screens/billing/BillingScreen';
import AccountScreen from '../screens/account/AccountScreen';

const Tab = createBottomTabNavigator<TabParamList>();

function Glyph({ char, color }: { char: string; color: string }) {
  return (
    <Text style={{ fontSize: 18, color, fontWeight: '600' }}>{char}</Text>
  );
}

export default function AppTabs() {
  const { user } = useAuth();
  const isLandlord = user?.role === 'LANDLORD';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Glyph char="⌂" color={color} /> }}
      />
      {!isLandlord && (
        <Tab.Screen
          name="Discover"
          component={DiscoverScreen}
          options={{ title: 'Discover', tabBarIcon: ({ color }) => <Glyph char="◈" color={color} /> }}
        />
      )}
      {isLandlord && (
        <Tab.Screen
          name="Properties"
          component={PropertiesScreen}
          options={{ title: 'Properties', tabBarIcon: ({ color }) => <Glyph char="▤" color={color} /> }}
        />
      )}
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Updates', tabBarIcon: ({ color }) => <Glyph char="◉" color={color} /> }}
      />
      <Tab.Screen
        name="Billing"
        component={BillingScreen}
        options={{ title: 'Billing', tabBarIcon: ({ color }) => <Glyph char="₹" color={color} /> }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: 'Account', tabBarIcon: ({ color }) => <Glyph char="⊙" color={color} /> }}
      />
    </Tab.Navigator>
  );
}