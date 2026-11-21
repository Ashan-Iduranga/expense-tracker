This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Daily Strip AI (receipt scanning + insights)

Plan: `Project 3 — Daily Strip AI End-to-End Build Plan.docx` (one folder up), as changed in `docs/adr/`.

### Stack
- App: this Expo app (TypeScript). AI is an optional online add-on; manual entry and offline use must keep working exactly as before.
- `apps/receipt-api`: FastAPI, Pydantic v2, Python 3.12, uv. Deployed on Vercel (region `sin1`).
- Identity: the existing Firebase anonymous sign-in. The API verifies the Firebase ID token (`firebase-admin`); daily usage lives in Firestore `device_usage` (server-only).
- AI: Gemini vision with structured output.

### Git
- Do NOT commit or push. When a task is done, list the changed files and give the git commands; the user commits (signed) and pushes. No AI trailers anywhere.
- Never read, stage or copy anything in `private/` (receipt photos, `receipts-truth.csv`, notes).

### Rules
- No secrets in the app bundle. The Gemini key and Firebase service account exist only as receipt-api env vars.
- App gets its API token from `auth.currentUser.getIdToken()`; never store it in AsyncStorage.
- Before upload: resize to ~1600 px long edge, JPEG ~0.8, re-encode (strips EXIF/GPS).
- Server: Firebase ID token on every route except `/health`; daily scan cap per user; upload ≤ 1 MB, real image type checked from bytes; never write images to disk or logs; generic errors to the app.
- Model output must match the receipt schema; category must be one of the 8 ids in `src/data/categories.ts`; validate with Pydantic; the user confirms before anything is saved.
- `/insight` receives aggregated monthly totals only.
- New stored transaction fields need `firestore.rules` (`hasOnly`) + deploy. All app data goes through `src/data/sync.ts`.
- Tell the user the name, weekly downloads and repo URL before adding any dependency.

### The user writes these themselves
- Receipt sanity checks (`apps/receipt-api/.../sanity.py`: items vs total, date range).
- Merchant normaliser and category-rule logic (`src/lib/category-rules.ts`).
- The 30-receipt truth file.
