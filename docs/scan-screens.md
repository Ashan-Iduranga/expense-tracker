# Daily Strip AI: screen notes (Phase 0)

Built in the existing **Volt** system: tokens in `src/constants/theme.ts`, motion in `src/constants/motion.ts`, Bebas display type through `displayType()` (iOS clipping fix), Barlow for body text, and font scaling capped for large-text phones. The shared bottom sheet is `src/components/sheet.tsx`.
From the `quiet-product` style guide we also take: one primary button per view, empty and error states that say what to do next, and animation only in response to an action.

## 1. Scan entry
- **Add screen:** a "Scan receipt" chip at the top of the expense form (camera icon). Tapping it opens a small sheet: *Take photo* / *Choose from gallery*.
- **Home:** the long-press quick action on the add button also offers "Scan receipt" (Phase 3, if it fits the pill nav).
- **Offline:** the chip shows a muted look with "Needs internet". Tapping it shows a toast: "Scanning needs internet. You can still add it by hand." The form below works as normal.
- **Permission:** asked only on tap, with the reason "Daily Strip uses the camera to read the receipt you photograph."

## 2. Reading (upload + extraction)
- Full-height sheet with the photo thumbnail, a lime progress bar for the upload, then "Reading receipt…" with a soft pulse. A Cancel text button.
- Target under 6 s. After 15 s it shows: "Taking longer than usual" with Retry / Enter by hand.

## 3. Review form (the core screen)
- Fields: **Amount** (big Bebas number), **Shop**, **Date**, **Category** (existing category chips), and **Items** collapsed under "8 items found" (shown only, not saved).
- Low confidence (< 0.8): `accentSoft` field background, a small "Check this" label and a screen-reader hint "Low confidence, please check".
- If the category came from a learned rule, it says "From your past Keells receipts".
- One primary button: **Save expense**, disabled until the amount is valid. Secondary: "Retake".
- Nothing is saved until the user taps Save. On Save it goes through the existing `addTransaction` with `source: 'scan'`.

## 4. Bad photo / not a receipt
- The same sheet with an icon and "We couldn't read this receipt", then tips as a short list: *Lay it flat · Good light · Fit the whole receipt*.
- Buttons: **Try again** (primary), "Enter by hand".
- Limit reached: "You've used today's 20 scans. They reset at midnight." with "Enter by hand".

## 5. Insight card (Insights tab)
- At the top of the month view: an `accentSoft` card with one or two sentences, e.g. "Food was 30% higher than last month, mostly at 3 shops."
- A small footnote: "Written by AI from your totals" or "From your totals" (template). Refreshes once per month, or when the user taps.

## 6. Settings rows
- "Receipt scanning" section: *Scans left today: 17 of 20*, *Delete scan data* (confirm sheet: it clears learned shops and scan history on this phone and the usage count on the server), and *How scanning uses your data* (privacy policy link).
