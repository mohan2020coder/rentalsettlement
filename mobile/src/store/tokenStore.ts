import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_PREFIX = 'rental.auth.';

function secure() {
  return Platform.OS === 'web' ? null : SecureStore;
}

export async function tokenStoreSet(key: string, value: string): Promise<void> {
  const s = secure();
  if (s) {
    await s.setItemAsync(TOKEN_PREFIX + key, value);
  } else {
    await AsyncStorage.setItem(TOKEN_PREFIX + key, value);
  }
}

export async function tokenStoreGet(key: string): Promise<string | null> {
  const s = secure();
  if (s) {
    return s.getItemAsync(TOKEN_PREFIX + key);
  }
  return AsyncStorage.getItem(TOKEN_PREFIX + key);
}

export async function tokenStoreDelete(key: string): Promise<void> {
  const s = secure();
  if (s) {
    await s.deleteItemAsync(TOKEN_PREFIX + key);
  } else {
    await AsyncStorage.removeItem(TOKEN_PREFIX + key);
  }
}