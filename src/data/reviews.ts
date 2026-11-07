import Constants from 'expo-constants';
import { useEffect, useState } from 'react';

import { useAccount } from '@/data/account';
import { put, serverTime, watchDoc } from '@/data/sync';

/**
 * The user's rating of the app, one per install: reviews/{uid}. Approved reviews show on the
 * website. A star-only rating goes live at once; one with text waits as 'pending' until it is
 * approved in the Firebase console (firestore.rules enforces this).
 */
export type Review = {
  rating: number;
  text: string;
  name: string;
  status: 'approved' | 'pending';
};

export const ReviewTextMax = 280;
export const AnonymousName = 'A Daily Strip user';

export const appVersion = () => (Constants.expoConfig?.version ?? '').slice(0, 12);

/** The user's own review (null if they haven't rated yet), from the phone first and offline-safe. */
export function useMyReview() {
  const { user } = useAccount();
  const [review, setReview] = useState<Review | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    return watchDoc(['reviews', user.uid], (data, source) => {
      if (data) {
        setReview({
          rating: Number(data.rating) || 0,
          text: String(data.text ?? ''),
          name: String(data.name ?? AnonymousName),
          status: data.status === 'approved' ? 'approved' : 'pending',
        });
        setLoaded(true);
      } else if (source !== 'waiting') {
        setReview(null);
        setLoaded(true);
      }
    });
  }, [user]);

  function save(next: { rating: number; text: string; name: string }) {
    if (!user) throw new Error('Not signed in yet');
    const text = next.text.trim().slice(0, ReviewTextMax);
    put(
      ['reviews', user.uid],
      {
        rating: Math.round(Math.min(5, Math.max(1, next.rating))),
        text,
        name: next.name.trim().slice(0, 24) || AnonymousName,
        appVersion: appVersion(),
        status: text ? 'pending' : 'approved',
        updatedAt: serverTime(),
        // Only the first save sets createdAt; later edits merge and keep it.
        ...(review ? {} : { createdAt: serverTime() }),
      },
      { merge: true }
    );
  }

  return { review, loaded, save };
}
