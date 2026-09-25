import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { AuthProvider } from './src/auth/AuthContext';
import { UnreadProvider } from './src/notifications/UnreadContext';
import RootNavigator from './src/navigation/RootNavigator';
import { theme } from './src/theme';

enableScreens();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    primary: theme.colors.primary,
    text: theme.colors.text,
    border: theme.colors.border,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UnreadProvider>
          <NavigationContainer theme={navTheme}>
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </UnreadProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}