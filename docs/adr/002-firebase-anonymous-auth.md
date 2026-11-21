# ADR-002: Reuse Firebase anonymous auth for API identity and limits

Status: Accepted · 2026-11-21 · Replaces the plan doc's "Supabase anonymous auth"

## Context
The server must know who is calling to cap scans per day and block abuse. The plan doc proposed Supabase anonymous sign-in. But Daily Strip already signs every install in anonymously with Firebase (`src/data/account.tsx`) and syncs to Firestore.

## Decision
The app sends `Authorization: Bearer <Firebase ID token>` from `auth.currentUser.getIdToken()`. The API verifies it with `firebase-admin` and uses the uid. Daily usage is counted in Firestore `device_usage/{uid}_{YYYY-MM-DD}`, which clients can't read or write (rules deny it).

## Consequences
- One identity per install, no new SDK or keys in the app. The Firebase SDK refreshes the token for us, so nothing extra goes in secure storage.
- The API needs a Firebase service account (env var only).
- A user who reinstalls gets a new uid, and so a fresh daily cap. That's acceptable for v1, and the cap keeps cost bounded anyway.
