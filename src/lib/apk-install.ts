import { File, Paths } from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';
import { Platform } from 'react-native';

/**
 * Android only: download the new APK inside the app, then hand it to Android's installer.
 * Android always asks the user to tap Install (and, the first time, to allow installs from this app);
 * it then replaces this app in place, keeping its data. Other platforms open the link in the browser.
 */
export const canInstallInApp = Platform.OS === 'android';

const FLAG_GRANT_READ_URI_PERMISSION = 1;

export async function downloadApk(url: string, onProgress: (fraction: number) => void, signal?: AbortSignal) {
  const dest = new File(Paths.cache, 'daily-strip-update.apk');
  return File.downloadFileAsync(url, dest, {
    idempotent: true, // Replace a half-finished or older download.
    signal,
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (totalBytes > 0) onProgress(Math.min(1, bytesWritten / totalBytes));
    },
  });
}

export async function installApk(file: File) {
  await startActivityAsync('android.intent.action.VIEW', {
    data: file.contentUri,
    type: 'application/vnd.android.package-archive',
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}
