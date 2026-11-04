/** Shared helpers for the per-user collections (users/{uid}/<name>). Reads and writes go through ./sync. */
import { Timestamp } from 'firebase/firestore';

export { clearCollection } from '@/data/sync';

/** Path of users/{uid}/<name>, for the sync layer. */
export function userCollection(uid: string, name: string) {
  return ['users', uid, name];
}

/** Path of users/{uid}/<name>/{id}. */
export function userDoc(uid: string, name: string, id: string) {
  return ['users', uid, name, id];
}

/** Firestore timestamp (or missing) to Date (or null). */
export function toDate(v: unknown): Date | null {
  return v instanceof Timestamp ? v.toDate() : null;
}
