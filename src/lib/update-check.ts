import { useEffect, useState } from 'react';

import { APK_URL, RELEASES_API } from '@/constants/release';
import { appVersion } from '@/data/reviews';
import { kv } from '@/lib/kv';

/**
 * Is there a newer APK on GitHub Releases? Checked at most once a day; the answer is kept on the
 * phone so it shows offline too. Installing still goes through the browser, as the first install did.
 */
export type Update = { version: string; notes: string; url: string };

const KEY = 'ds:update-check';
const DAY = 24 * 60 * 60 * 1000;

type Saved = { at: number; latest: { version: string; notes: string } | null };

/** "v1.2.0" → [1, 2, 0]. */
function parts(v: string) {
  return v
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .slice(0, 3)
    .map((n) => Number.parseInt(n, 10) || 0);
}

export function isNewer(latest: string, current: string) {
  const a = parts(latest);
  const b = parts(current);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

async function fetchLatest(): Promise<Saved['latest']> {
  const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null; // The placeholder repo, no releases yet, or rate-limited.
  const json = (await res.json()) as { tag_name?: string; body?: string };
  return json.tag_name ? { version: json.tag_name.replace(/^v/i, ''), notes: (json.body ?? '').trim() } : null;
}

let shared: Promise<Saved['latest']> | null = null;

async function check(): Promise<Saved['latest']> {
  const raw = await kv.get(KEY).catch(() => null);
  const saved = raw ? (JSON.parse(raw) as Saved) : null;
  if (saved && Date.now() - saved.at < DAY) return saved.latest;
  try {
    const latest = await fetchLatest();
    kv.set(KEY, JSON.stringify({ at: Date.now(), latest } satisfies Saved)).catch(() => {});
    return latest;
  } catch {
    return saved?.latest ?? null; // Offline: keep the last answer.
  }
}

/** The newer version, or null when this one is the newest (or nothing is known yet). */
export function useUpdate(): Update | null {
  const [latest, setLatest] = useState<Saved['latest']>(null);
  useEffect(() => {
    let live = true;
    shared ??= check();
    shared.then((l) => live && setLatest(l));
    return () => {
      live = false;
    };
  }, []);
  if (!latest || !isNewer(latest.version, appVersion())) return null;
  return { ...latest, url: APK_URL };
}
