/**
 * On-device reminders for bills and loans (local notifications, which work in Expo Go).
 * Nothing goes through a server: each sync clears the reminders it made before and
 * schedules the next ones again.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, startOfDay } from '@/lib/format';

const Prefix = 'due-';
const Channel = 'reminders';
/** Only schedule this far ahead; the next sync picks up later ones. */
const HorizonDays = 30;

export type Reminder = { id: string; title: string; body: string; due: Date; url: string };

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

async function ensureChannel() {
  if (Platform.OS === 'android') {
    // The enum is re-exported through `export *`, which the import lint can't follow.
    // eslint-disable-next-line import/namespace
    await Notifications.setNotificationChannelAsync(Channel, { name: 'Bill and loan reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
}

/** Asks once, when the user first turns on a reminder. Returns whether we may notify. */
export async function ensurePermission() {
  if (!supported) return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** 9 am the day before; if that's gone, 9 am on the day; otherwise skip. */
function fireTime(due: Date, now: Date) {
  const day = startOfDay(due);
  const before = new Date(addDays(day, -1).getTime() + 9 * 3_600_000);
  const onDay = new Date(day.getTime() + 9 * 3_600_000);
  const soon = now.getTime() + 60_000;
  if (before.getTime() > soon) return before;
  if (onDay.getTime() > soon) return onDay;
  return null;
}

export async function syncReminders(items: Reminder[]) {
  if (!supported) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await ensureChannel();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((n) => n.identifier.startsWith(Prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    const now = new Date();
    const limit = addDays(now, HorizonDays);
    for (const item of items) {
      const at = fireTime(item.due, now);
      if (!at || at > limit) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${Prefix}${item.id}`,
        content: { title: item.title, body: item.body, data: { url: item.url } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: Channel },
      });
    }
  } catch (e) {
    // Reminders are a nice-to-have; never let them break the app.
    console.warn('Reminder sync failed', e);
  }
}

/** Opens the screen a reminder points at, when it's tapped (also from a cold start). */
export function onReminderTap(open: (url: string) => void) {
  if (!supported) return () => {};
  const handle = (n: Notifications.Notification) => {
    const url = n.request.content.data?.url;
    if (typeof url === 'string') {
      open(url);
      Notifications.clearLastNotificationResponse();
    }
  };
  const last = Notifications.getLastNotificationResponse();
  if (last?.notification) handle(last.notification);
  const sub = Notifications.addNotificationResponseReceivedListener((r) => handle(r.notification));
  return () => sub.remove();
}
