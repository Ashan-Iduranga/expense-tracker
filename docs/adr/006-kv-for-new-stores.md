# ADR-006: Keep the existing kv store (AsyncStorage) for scans and rules

Status: Accepted · 2026-11-21

## Context
New device-only data: `scans` (accepted/edited stats), `category_rules`, `insights`. The options are the existing `src/lib/kv.ts` (AsyncStorage, with a web variant) or expo-sqlite tables.

## Decision
Use kv. Each store is a small JSON value (hundreds of entries at most), read whole and written whole. Expenses keep going through `src/data/sync.ts` and gain optional `merchant`, `source`, `scanId` fields.

## Consequences
- No migrations and no new storage layer. It already works on web.
- If scan history ever needs queries or grows large, move it to expo-sqlite (already installed).
