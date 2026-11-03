import { getReactNativePersistence, initializeAuth } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseApp } from 'firebase/app';

/**
 * iOS/Android: keep the session in AsyncStorage. Without this, every launch
 * would sign in as a new anonymous user and the old expenses would vanish.
 */
export function createAuth(app: FirebaseApp) {
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}
