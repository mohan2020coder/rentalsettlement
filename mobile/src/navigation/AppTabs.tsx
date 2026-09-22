import React, { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
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

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  focused,
  color,
  icons,
}: {
  focused: boolean;
  color: string;
  icons: { active: IoniconName; inactive: IoniconName };
}) {
  return (
    <View style={styles.tabIcon}>
      {focused ? <View style={styles.tabIconPill} /> : null}
      <Ionicons name={focused ? icons.active : icons.inactive} size={22} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 42,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconPill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
    backgroundColor: theme.colors.primarySoft,
  },
});

export default function AppTabs() {
  const { user } = useAuth();
  const isLandlord = user?.role === 'LANDLORD';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 0,
          shadowColor: '#0B1C44',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 12,
          paddingTop: 6,
          height: 64,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} icons={{ active: 'home', inactive: 'home-outline' }} />
          ),
        }}
      />
      {!isLandlord && (
        <Tab.Screen
          name="Discover"
          component={DiscoverScreen}
          options={{
            title: 'Discover',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon focused={focused} color={color} icons={{ active: 'search', inactive: 'search-outline' }} />
            ),
          }}
        />
      )}
      {isLandlord && (
        <Tab.Screen
          name="Properties"
          component={PropertiesScreen}
          options={{
            title: 'Properties',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon focused={focused} color={color} icons={{ active: 'business', inactive: 'business-outline' }} />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Updates',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} icons={{ active: 'notifications', inactive: 'notifications-outline' }} />
          ),
        }}
      />
      <Tab.Screen
        name="Billing"
        component={BillingScreen}
        options={{
          title: 'Plan',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} icons={{ active: 'card', inactive: 'card-outline' }} />
          ),
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          title: 'Account',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} icons={{ active: 'person', inactive: 'person-outline' }} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}