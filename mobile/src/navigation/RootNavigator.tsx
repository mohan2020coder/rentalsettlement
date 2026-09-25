import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { LoadingView } from '../components/ui';
import { RootStackParamList } from './types';
import AppTabs from './AppTabs';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView label="Starting…" />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={AppTabs} options={{ animation: 'fade' }} />
      ) : (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'slide_from_right' }} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}