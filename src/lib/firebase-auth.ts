import type { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/** Web: the browser keeps the session in IndexedDB by default. */
export function createAuth(app: FirebaseApp) {
  return getAuth(app);
}
