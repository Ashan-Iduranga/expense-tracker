# ADR-003: Receipt images processed in memory, never stored

Status: Accepted · 2026-11-21

## Context
Receipts show where and when someone shops. Storing them adds risk and PDPA duties for no benefit to the user.

## Decision
The phone resizes and re-encodes the image (drops EXIF/GPS). The API reads the upload into memory, sends it to Gemini and discards it. Nothing is written to disk, a bucket or logs. Line items are shown on the review form but not saved.

## Consequences
- No image history and no way to re-run an old scan on the server. The user keeps the photo on their phone if they want it.
- We use Gemini's paid tier before a public release, so prompts aren't used to train models (check the current terms).
