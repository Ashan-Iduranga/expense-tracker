# ADR-004: Category learning on the device with rules, not the model

Status: Accepted · 2026-11-21

## Context
When the user corrects "Keells → shopping" to "food", the next Keells receipt should get it right. Fine-tuning or sending history to the model is costly and leaks data.

## Decision
A normalised merchant key → category map is stored on the device (`src/lib/category-rules.ts`, kv). Order: local rule first, model suggestion second.

## Consequences
- Instant, offline, private and testable with plain unit tests.
- Rules don't follow the user to a new phone. That's fine for v1.
