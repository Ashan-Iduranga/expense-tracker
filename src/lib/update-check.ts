import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { APK_URL, RELEASES_API } from '@/constants/release';
import { appVersion } from '@/data/reviews';
import { kv } from '@/lib/kv';

/**
 * Is there a newer APK on GitHub Releases? Asked on every launch, again when the app comes back
 * after an hour away, and whenever the user taps "check" in Settings. The last answer is kept on
 * the phone only as an offline fallback, and only for the version that saved it.
 */
export type Update = { version: string; notes: string; url: string };
type Latest = { version: string; notes: string } | null;
type Saved = { at: number; appVersion: string; latest: Latest };
export type CheckResult = 'update' | 'latest' | 'offline';

const KEY = 'ds:update-check';
const HOUR = 60 * 60 * 1000;

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

/** Throws when offline or GitHub won't answer, so callers can tell that apart from "no release". */
async function fetchLatest(): Promise<Latest> {
  const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 404) return null; // No releases yet.
  if (!res.ok) throw new Error(`GitHub ${res.status}`); // Rate-limited or down.
  const json = (await res.json()) as { tag_name?: string; body?: string };
  return json.tag_name ? { version: json.tag_name.replace(/^v/i, ''), notes: (json.body ?? '').trim() } : null;
}

// A tiny shared store, so the Home banner and Settings always agree.
let latest: Latest = null;
let checkedAt = 0;
let inFlight: Promise<boolean> | null = null;
let started = false;
const listeners = new Set<() => void>();

function publish(l: Latest) {
  latest = l;
  listeners.forEach((fn) => fn());
}

async function loadSaved() {
  try {
    const raw = await kv.get(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Saved>) : null;
    // An answer saved by another install of the app says nothing about this one.
    if (saved && saved.appVersion === appVersion() && checkedAt === 0) publish(saved.latest ?? null);
  } catch {}
}

/** Ask GitHub now. Resolves true when it answered, false when offline. Calls share one request. */
function refresh(): Promise<boolean> {
  inFlight ??= fetchLatest()
    .then((l) => {
      checkedAt = Date.now();
      publish(l);
      kv.set(KEY, JSON.stringify({ at: checkedAt, appVersion: appVersion(), latest: l } satisfies Saved)).catch(() => {});
      return true;
    })
    .catch(() => false)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function start() {
  if (started) return;
  started = true;
  loadSaved().then(refresh);
  AppState.addEventListener('change', (s) => {
    if (s === 'active' && Date.now() - checkedAt > HOUR) refresh();
  });
}

const asUpdate = (l: Latest): Update | null =>
  l && isNewer(l.version, appVersion()) ? { ...l, url: APK_URL } : null;

/** Check right now (the Settings "check for updates" tap). */
export async function checkForUpdate(): Promise<CheckResult> {
  start();
  const ok = await refresh();
  if (!ok) return 'offline';
  return asUpdate(latest) ? 'update' : 'latest';
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  start();
  return () => {
    listeners.delete(fn);
  };
}

/** The newer version, or null when this one is the newest (or nothing is known yet). */
export function useUpdate(): Update | null {
  return asUpdate(useSyncExternalStore(subscribe, () => latest));
}
