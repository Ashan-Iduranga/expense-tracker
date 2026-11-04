/**
 * Offline-first data. Every change is saved on the phone first and shows straight away,
 * then an outbox uploads it to Firestore when there's a connection, even after a restart.
 *
 * The Firebase JS SDK only caches in memory on React Native, so on its own anything done
 * offline was lost when the app closed. Here, per watched target (a collection or a doc):
 *   base   = the last server-confirmed data, kept on the device
 *   outbox = changes not yet confirmed by the server, kept on the device, in order
 *   view   = base with the outbox applied on top: what the screens see
 */
import * as Network from 'expo-network';
import {
  collection,
  deleteField,
  doc,
  getDocsFromServer,
  increment,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type DocumentData,
  type WriteBatch,
} from 'firebase/firestore';
import { useSyncExternalStore } from 'react';
import { Alert, AppState } from 'react-native';

import { db } from '@/lib/firebase';
import { kv } from '@/lib/kv';

// ─── Values ───────────────────────────────────────────────────────────────────

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Fields = Record<string, Json>;

/** Use instead of serverTimestamp(): "now" on the phone, the server's clock once uploaded. */
export const serverTime = () => ({ $server: true }) as unknown as Timestamp;
/** Use instead of increment(n): added to the current value, here and on the server. */
export const inc = (n: number) => ({ $inc: n }) as unknown as number;
/** Use instead of deleteField(). */
export const removeField = () => ({ $del: true }) as unknown as undefined;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** App values (Timestamps, Dates) → plain JSON for the device. Markers pass through. */
function encode(v: unknown): Json {
  if (v instanceof Timestamp) return { $ts: v.toMillis() };
  if (v instanceof Date) return { $ts: v.getTime() };
  if (Array.isArray(v)) return v.map(encode);
  if (isObj(v)) {
    const out: Fields = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = encode(x);
    return out;
  }
  return (v ?? null) as Json;
}

/** Device JSON → what the providers read (Timestamps back). */
function decode(v: Json): unknown {
  if (Array.isArray(v)) return v.map(decode);
  if (isObj(v)) {
    if (typeof v.$ts === 'number') return Timestamp.fromMillis(v.$ts);
    const out: DocumentData = {};
    for (const [k, x] of Object.entries(v)) out[k] = decode(x as Json);
    return out;
  }
  return v;
}

/** Device JSON (with markers) → what Firestore takes. */
function toFirestore(v: Json): unknown {
  if (Array.isArray(v)) return v.map(toFirestore);
  if (isObj(v)) {
    if (typeof v.$ts === 'number') return Timestamp.fromMillis(v.$ts);
    if (v.$server === true) return serverTimestamp();
    if (typeof v.$inc === 'number') return increment(v.$inc);
    if (v.$del === true) return deleteField();
    const out: DocumentData = {};
    for (const [k, x] of Object.entries(v)) out[k] = toFirestore(x as Json);
    return out;
  }
  return v;
}

// ─── Outbox ───────────────────────────────────────────────────────────────────

type Op = {
  id: string;
  kind: 'set' | 'update' | 'delete' | 'clear';
  /** Doc path, or the collection path for 'clear'. */
  path: string[];
  data?: Fields;
  merge?: boolean;
  /** When it was made, so a local "server time" doesn't move on every render. */
  at: number;
};

/** Applies one change to a doc's data, the way Firestore would. */
function applyOp(cur: Fields | null, op: Op): Fields | null {
  if (op.kind === 'delete' || op.kind === 'clear') return null;
  if (op.kind === 'update' && !cur) return cur; // Firestore rejects updates to missing docs.
  const next: Fields = op.kind === 'set' && !op.merge ? {} : { ...(cur ?? {}) };
  for (const [k, v] of Object.entries(op.data ?? {})) {
    if (isObj(v) && v.$server === true) next[k] = { $ts: op.at };
    else if (isObj(v) && typeof v.$inc === 'number') next[k] = (typeof next[k] === 'number' ? (next[k] as number) : 0) + v.$inc;
    else if (isObj(v) && v.$del === true) delete next[k];
    else next[k] = v;
  }
  return next;
}

// ─── State ────────────────────────────────────────────────────────────────────

type Base = { docs: Record<string, Fields> } | { data: Fields | null };
/** Internal: 'local' = no server answer yet; 'server' = confirmed; 'offline' = no answer and nothing saved. */
type Source = 'local' | 'server' | 'offline';
/**
 * What a doc watcher knows: 'server' = confirmed by the server; 'device' = known from this
 * phone (a saved copy or pending changes); 'waiting' = nothing yet; 'offline' = nothing saved and no connection.
 */
export type DocSource = 'server' | 'device' | 'waiting' | 'offline';

type Target = {
  path: string[];
  isDoc: boolean;
  listeners: Set<() => void>;
  base: Base | null;
  source: Source;
  /** The device copy has been read. */
  loaded: boolean;
  stopServer?: () => void;
  saveTimer?: ReturnType<typeof setTimeout>;
};

const targets = new Map<string, Target>();
let outbox: Op[] = [];
let outboxUid: string | null = null;
let outboxLoad: Promise<void> | null = null;
/** Set once the saved outbox for this user has been read from the device. */
let loadedUid: string | null = null;

const keyOf = (path: string[]) => path.join('/');
const uidOf = (path: string[]) => path[1];
const baseKey = (path: string[]) => `ds:base:${keyOf(path)}`;
const outboxKey = (uid: string) => `ds:outbox:${uid}`;

function loadOutbox(uid: string) {
  if (outboxUid === uid && outboxLoad) return outboxLoad;
  watchNetwork();
  outboxUid = uid;
  outboxLoad = kv
    .get(outboxKey(uid))
    .then((raw) => (raw ? (JSON.parse(raw) as Op[]) : []))
    .catch(() => [] as Op[])
    .then((saved) => {
      // Keep anything changed while the saved outbox was still loading, after the saved ones.
      const known = new Set(saved.map((o) => o.id));
      outbox = [...saved, ...outbox.filter((o) => !known.has(o.id))];
      loadedUid = uid;
      saveOutbox();
      targets.forEach((t) => t.listeners.forEach((l) => l()));
      flush();
    });
  return outboxLoad;
}

function saveOutbox() {
  if (outboxUid) kv.set(outboxKey(outboxUid), JSON.stringify(outbox)).catch(() => {});
  notifyStatus();
}

function saveBase(t: Target) {
  clearTimeout(t.saveTimer);
  t.saveTimer = setTimeout(() => {
    if (t.base) kv.set(baseKey(t.path), JSON.stringify(t.base)).catch(() => {});
  }, 400);
}

/** Does this change touch this target? */
function touches(t: Target, op: Op) {
  const k = keyOf(t.path);
  if (t.isDoc) return keyOf(op.path) === k || (op.kind === 'clear' && keyOf(op.path) === keyOf(t.path.slice(0, -1)));
  return op.kind === 'clear' ? keyOf(op.path) === k : keyOf(op.path.slice(0, -1)) === k;
}

function emitFor(op: Op) {
  for (const t of targets.values()) if (touches(t, op)) t.listeners.forEach((l) => l());
}

// ─── Reading ──────────────────────────────────────────────────────────────────

export type LocalDoc = { id: string; data: () => DocumentData };

function viewOfCollection(t: Target): LocalDoc[] {
  const docs: Record<string, Fields> = {
    ...(t.base && 'docs' in t.base ? t.base.docs : {}),
  };
  for (const op of outbox) {
    if (!touches(t, op)) continue;
    if (op.kind === 'clear') {
      for (const id of Object.keys(docs)) delete docs[id];
      continue;
    }
    const id = op.path[op.path.length - 1];
    const next = applyOp(docs[id] ?? null, op);
    if (next) docs[id] = next;
    else delete docs[id];
  }
  return Object.entries(docs).map(([id, f]) => ({
    id,
    data: () => decode(f) as DocumentData,
  }));
}

function viewOfDoc(t: Target): DocumentData | undefined {
  let data = t.base && 'data' in t.base ? t.base.data : null;
  for (const op of outbox) if (touches(t, op)) data = applyOp(data, op);
  return data ? (decode(data) as DocumentData) : undefined;
}

function hasPendingFor(t: Target) {
  return outbox.some((op) => touches(t, op));
}

function getTarget(path: string[], isDoc: boolean) {
  const key = keyOf(path);
  let t = targets.get(key);
  if (!t) {
    t = {
      path,
      isDoc,
      listeners: new Set(),
      base: null,
      source: 'local',
      loaded: false,
    };
    targets.set(key, t);
  }
  return t;
}

/** Starts the server listener for a target the first time someone watches it. */
function startTarget(t: Target) {
  if (t.stopServer) return;
  let stopped = false;
  let unsub: (() => void) | undefined;
  t.stopServer = () => {
    stopped = true;
    unsub?.();
  };
  Promise.all([loadOutbox(uidOf(t.path)), kv.get(baseKey(t.path)).catch(() => null)]).then(([, raw]) => {
    if (stopped) return;
    if (raw && !t.base) t.base = JSON.parse(raw) as Base;
    t.loaded = true;
    t.listeners.forEach((l) => l());

    const onError = () => {
      if (!t.base && t.source !== 'server') {
        t.source = 'offline';
        t.listeners.forEach((l) => l());
      }
    };
    type Snap = {
      metadata: { fromCache: boolean; hasPendingWrites: boolean };
      docs?: { id: string; data: () => DocumentData }[];
      data?: () => DocumentData | undefined;
    };
    const onSnap = (snap: Snap) => {
      if (snap.metadata.fromCache) {
        // No server answer yet. Keep the device copy; only a true first run with
        // nothing saved anywhere needs to know it's offline.
        if (!t.base && !hasPendingFor(t) && t.source === 'local') {
          t.source = 'offline';
          t.listeners.forEach((l) => l());
        }
        return;
      }
      // Wait until our own uploads are confirmed, so nothing is counted twice.
      if (snap.metadata.hasPendingWrites) return;
      if (t.isDoc) {
        const d = snap.data?.();
        t.base = { data: d ? (encode(d) as Fields) : null };
      } else {
        const docs: Record<string, Fields> = {};
        for (const d of snap.docs ?? []) docs[d.id] = encode(d.data()) as Fields;
        t.base = { docs };
      }
      t.source = 'server';
      saveBase(t);
      t.listeners.forEach((l) => l());
    };
    const opts = { includeMetadataChanges: true };
    unsub = t.isDoc ? onSnapshot(doc(db, keyOf(t.path)), opts, onSnap, onError) : onSnapshot(collection(db, keyOf(t.path)), opts, onSnap, onError);
  });
}

function subscribe(t: Target, listener: () => void) {
  t.listeners.add(listener);
  // Already running for another screen: give this one the current data straight away.
  if (t.stopServer && t.loaded) queueMicrotask(listener);
  startTarget(t);
  return () => {
    t.listeners.delete(listener);
    if (t.listeners.size === 0) {
      t.stopServer?.();
      t.stopServer = undefined;
    }
  };
}

/** Like onSnapshot on a collection, but from the device first and working offline. */
export function watchCollection(path: string[], onChange: (docs: LocalDoc[]) => void) {
  const t = getTarget(path, false);
  const emit = () => {
    if (t.loaded && outboxLoaded(path)) onChange(viewOfCollection(t));
  };
  return subscribe(t, emit);
}

/** Like onSnapshot on a single doc, but from the device first and working offline. */
export function watchDoc(path: string[], onChange: (data: DocumentData | undefined, source: DocSource) => void) {
  const t = getTarget(path, true);
  const emit = () => {
    if (!t.loaded || !outboxLoaded(path)) return;
    // Something saved on the phone beats "offline": the app can open with it.
    const source: DocSource =
      t.source === 'server' ? 'server' : t.base || hasPendingFor(t) ? 'device' : t.source === 'offline' ? 'offline' : 'waiting';
    onChange(viewOfDoc(t), source);
  };
  return subscribe(t, emit);
}

function outboxLoaded(path: string[]) {
  return loadedUid === uidOf(path);
}

// ─── Writing ──────────────────────────────────────────────────────────────────

let seq = 0;
function push(op: Omit<Op, 'id' | 'at'>) {
  const full: Op = {
    ...op,
    id: `${Date.now().toString(36)}-${(seq++).toString(36)}`,
    at: Date.now(),
  };
  outbox.push(full);
  saveOutbox();
  emitFor(full);
  flush();
}

/** A new document id, made on the phone (works offline). */
export function newId(collectionPath: string[]) {
  return doc(collection(db, keyOf(collectionPath))).id;
}

export function put(path: string[], data: object, options?: { merge?: boolean }) {
  push({
    kind: 'set',
    path,
    data: encode(data) as Fields,
    merge: options?.merge,
  });
}

export function patch(path: string[], data: object) {
  push({ kind: 'update', path, data: encode(data) as Fields });
}

export function remove(path: string[]) {
  push({ kind: 'delete', path });
}

/** Deletes every document in a collection, including ones never loaded on this phone. */
export function clearCollection(path: string[]) {
  push({ kind: 'clear', path });
}

// ─── Uploading ────────────────────────────────────────────────────────────────

let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

/** The server said no: retrying won't help (usually the security rules). */
function isPermanent(e: unknown) {
  const code = (e as { code?: string })?.code ?? '';
  return ['permission-denied', 'invalid-argument', 'not-found', 'failed-precondition', 'out-of-range'].some((c) => code.endsWith(c));
}

function addToBatch(b: WriteBatch, op: Op) {
  const ref = doc(db, keyOf(op.path));
  if (op.kind === 'delete') b.delete(ref);
  else if (op.kind === 'update') b.update(ref, toFirestore(op.data ?? {}) as DocumentData);
  else
    b.set(ref, toFirestore(op.data ?? {}) as DocumentData, {
      merge: !!op.merge,
    });
}

function drop(ids: string[]) {
  const gone = outbox.filter((o) => ids.includes(o.id));
  outbox = outbox.filter((o) => !ids.includes(o.id));
  saveOutbox();
  gone.forEach(emitFor);
}

async function runClear(op: Op) {
  const snap = await getDocsFromServer(collection(db, keyOf(op.path)));
  for (let i = 0; i < snap.docs.length; i += 450) {
    const b = writeBatch(db);
    snap.docs.slice(i, i + 450).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
}

function rejected(op: Op, e: unknown) {
  console.error('Sync rejected', op.kind, keyOf(op.path), e);
  Alert.alert('Couldn’t save a change', 'The server rejected one change, so it was undone on this phone. Please try again.');
}

/** Uploads the outbox in order. One batch at a time; offline, the SDK holds it until it can send. */
export async function flush() {
  if (flushing || !loadedUid || !outbox.length || !status.online) return;
  flushing = true;
  clearTimeout(retryTimer);
  try {
    while (outbox.length) {
      const first = outbox[0];
      if (first.kind === 'clear') {
        await runClear(first);
        drop([first.id]);
        continue;
      }
      const ops: Op[] = [];
      for (const op of outbox) {
        if (op.kind === 'clear' || ops.length === 400) break;
        ops.push(op);
      }
      try {
        const b = writeBatch(db);
        ops.forEach((op) => addToBatch(b, op));
        await b.commit();
        drop(ops.map((o) => o.id));
      } catch (e) {
        if (!isPermanent(e)) throw e;
        // One bad change rejects the whole batch: send them one by one and drop only the bad one.
        for (const op of ops) {
          try {
            const one = writeBatch(db);
            addToBatch(one, op);
            await one.commit();
          } catch (err) {
            if (!isPermanent(err)) throw err;
            rejected(op, err);
          }
          drop([op.id]);
        }
      }
    }
  } catch {
    retryTimer = setTimeout(flush, 5000);
  } finally {
    flushing = false;
  }
}

// ─── Status (for the offline badge) ──────────────────────────────────────────

let status = { online: true, pending: 0 };
const statusListeners = new Set<() => void>();

function notifyStatus() {
  const next = { online: status.online, pending: outbox.length };
  if (next.online === status.online && next.pending === status.pending) return;
  status = next;
  statusListeners.forEach((l) => l());
}

function setOnline(online: boolean) {
  if (online === status.online) return;
  status = { ...status, online };
  statusListeners.forEach((l) => l());
  if (online) flush();
}

const readNet = (s: Network.NetworkState) => s.isConnected !== false && s.isInternetReachable !== false;
let watchingNet = false;
/** Started on first use, not at import: the web build also runs this file on the server. */
function watchNetwork() {
  if (watchingNet) return;
  watchingNet = true;
  Network.getNetworkStateAsync()
    .then((s) => setOnline(readNet(s)))
    .catch(() => {});
  Network.addNetworkStateListener((s) => setOnline(readNet(s)));
  AppState.addEventListener('change', (s) => {
    if (s === 'active') flush();
  });
}

/** Whether the phone is online, and how many changes are still waiting to upload. */
export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => {
      watchNetwork();
      statusListeners.add(l);
      return () => statusListeners.delete(l);
    },
    () => status,
    () => status,
  );
}
