import Storage from 'expo-sqlite/kv-store';

/**
 * Key-value storage on the device for the offline copy of the user's data.
 * SQLite-backed on iOS/Android, so a long transaction history doesn't hit
 * AsyncStorage's size limits on Android.
 */
export const kv = {
  get: (key: string) => Storage.getItemAsync(key),
  set: (key: string, value: string) => Storage.setItemAsync(key, value),
  remove: (key: string) => Storage.removeItemAsync(key).then(() => undefined),
};
