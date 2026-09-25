import React, { ComponentProps, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { useUnread } from '../notifications/UnreadContext';
import { theme } from '../theme';
import { TabParamList } from './types';
import { HomeTabStack, DiscoverTabStack, PropertiesTabStack } from './TabStacks';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import BillingScreen from '../screens/billing/BillingScreen';
import AccountScreen from '../screens/account/AccountScreen';

const Tab = createBottomTabNavigator<TabParamList>();

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  focused,
  color,
  icons,
  badgeCount = 0,
}: {
  focused: boolean;
  color: string;
  icons: { active: IoniconName; inactive: IoniconName };
  badgeCount?: number;
}) {
  return (
    <View style={styles.tabIcon}>
      {focused ? <View style={styles.tabIconPill} /> : null}
      <Ionicons name={focused ? icons.active : icons.inactive} size={22} color={color} />
      {badgeCount > 0 ? (
        <View style={styles.tabIconBadge}>
          <Text style={styles.tabIconBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

function UpdatesTabIcon({ focused, color }: { focused: boolean; color: string }) {
  const { count, refresh } = useUnread();
  useEffect(() => {
    if (focused) void refresh();
  }, [focused]);
  return (
    <TabIcon
      focused={focused}
      color={color}
      icons={{ active: 'notifications', inactive: 'notifications-outline' }}
      badgeCount={count}
    />
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
  tabIconBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabIconBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});

export default function AppTabs() {
  const { user } = useAuth();
  const isLandlord = user?.role === 'LANDLORD';

  return (
    <Tab.Navigator
      screenOptions={{
        lazy: false,
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
        component={HomeTabStack}
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
          component={DiscoverTabStack}
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
          component={PropertiesTabStack}
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
            <UpdatesTabIcon focused={focused} color={color} />
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