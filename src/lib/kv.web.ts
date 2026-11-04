import AsyncStorage from '@react-native-async-storage/async-storage';

/** Web: the same API on browser storage (expo-sqlite needs extra setup on web). */
export const kv = {
  get: (key: string) => AsyncStorage.getItem(key),
  set: (key: string, value: string) => AsyncStorage.setItem(key, value),
  remove: (key: string) => AsyncStorage.removeItem(key),
};
