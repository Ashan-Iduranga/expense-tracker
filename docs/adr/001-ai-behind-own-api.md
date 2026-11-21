# ADR-001: AI behind our own API, never called from the app

Status: Accepted · 2026-11-21

## Context
Anything inside a React Native bundle can be pulled out of the APK. A Gemini key in the app would be found and abused, and the bill would be ours.

## Decision
The app never calls Gemini. It sends a compressed image to `apps/receipt-api` (FastAPI), which holds the key as an env var and returns validated JSON.

## Consequences
- The key never ships. We can rate-limit, validate output and change models without an app release.
- Scanning needs internet and one more service to run. Manual entry is unaffected.
