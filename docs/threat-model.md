# Daily Strip AI: threat model

Scope: receipt scanning (`POST /scan-receipt`), insights (`POST /insight`), usage routes, and the app-side flow. Status boxes are ticked when a test or review proves them.

## Assets
- Gemini API key and Firebase service account (server env only)
- Receipt images (sensitive spending and location data, never stored)
- Users' expenses (on the phone, synced to Firestore under their uid)
- Our money: Gemini and hosting usage

## Data flow
Phone (compress, strip EXIF) → HTTPS + Firebase ID token → receipt-api on Vercel → Gemini → Pydantic-validated JSON → review form → user taps Save → existing sync layer.

## Mobile app (guide 15.5)
- [ ] No secrets in the bundle: only `EXPO_PUBLIC_FIREBASE_*` and the API URL (checked by grepping the built bundle)
- [ ] Token comes from the Firebase SDK and is never copied into AsyncStorage
- [ ] HTTPS only; API URL from config
- [ ] Camera/photos permission asked only when the user taps Scan, with a reason string
- [ ] Image re-encoded before upload (EXIF/GPS gone): checked on a real photo

## API
- [ ] 401 on every route except `/health` without a valid Firebase ID token
- [ ] 429 after the daily cap (20 scans) and the per-minute limit
- [ ] Upload ≤ 1 MB; type checked from magic bytes (jpeg/png/webp); anything else is 415
- [ ] Image never written to disk or logged; logs hold uid hash, status and latency only
- [ ] Model output validated by Pydantic; bad output → generic 502, no raw model text to the app
- [ ] CORS closed (no browser origins)
- [ ] `device_usage` denied to clients in `firestore.rules`

## LLM risks (OWASP LLM Top 10)
| Risk | Mitigation |
|---|---|
| Prompt injection via text on the receipt | Schema-only structured output, no tools, prompt says image text is data; values validated in code |
| Sensitive info disclosure | Insight call gets aggregated totals only; no account data exists |
| Unbounded consumption | Daily cap, per-minute limit, max output tokens, 1 MB upload, billing alert |
| Improper output handling | Values only fill form fields; the user confirms before save; numbers range-checked |

## Privacy (PDPA-aware)
- [ ] Privacy policy (landing page + Settings): what is sent (image, aggregated totals), why, who processes it (Vercel, Google Gemini, Firebase), retention (images not stored)
- [ ] Settings → "Delete scan data": clears local scans and rules and calls `DELETE /me`
- [ ] Gemini paid tier before public release (terms checked)
