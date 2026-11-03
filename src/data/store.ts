/** Shared Firestore helpers for the per-user collections (users/{uid}/<name>). */
import { collection, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { Alert } from 'react-native';

import { db } from '@/lib/firebase';

export function userCollection(uid: string, name: string) {
  return collection(db, 'users', uid, name);
}

/**
 * Writes aren't awaited: snapshot listeners show changes straight away and Firestore
 * retries offline. This reports the rare write the server rejects (usually the rules).
 */
export function reportFailure(action: string) {
  return (error: unknown) => {
    console.error(`${action} failed`, error);
    Alert.alert(`Couldn’t ${action.toLowerCase()}`, 'The server rejected the change. Please try again.');
  };
}

/** Deletes a whole collection in batches (Settings → Delete all data). */
export async function clearCollection(uid: string, name: string) {
  const snap = await getDocs(userCollection(uid, name));
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/** Firestore timestamp (or missing) to Date (or null). */
export function toDate(v: unknown): Date | null {
  return v instanceof Timestamp ? v.toDate() : null;
}
