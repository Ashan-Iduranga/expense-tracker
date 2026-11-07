# Releasing an update of Daily Strip

This guide explains how users get new versions of the app, and what to do **every time you change the app**.

---

## 1. How updates work

```
 You                          GitHub (public repo)                 User's phone
 ───                          ────────────────────                 ────────────
 1. Build a new APK  ───────►  2. Release "v1.2.0"
                                  + daily-strip.apk  ◄──────────  3. App checks once a day:
                                                                     "is there a newer version?"
                                                                  4. Banner on Home:
                                                                     "Daily Strip 1.2.0 is out"
                                                                  5. User taps Update →
                                                                     APK downloads inside the app
                                                                  6. Android shows "Install" →
                                                                     user taps it → app is replaced,
                                                                     data stays
```

- **Where releases live:** https://github.com/Ashan-Iduranga/daily-strip-releases. It's public and holds only APKs and notes. Your code repo stays private.
- **How the app finds a new version:** it compares the release **tag** (e.g. `v1.2.0`) with the `"version"` in `app.json` it was built with. If the tag is higher, the user sees the update.
- **No uninstall:** Android replaces the old app in place, so user data is kept. The data is in their account and on the phone anyway.
- **The landing page** download button always gives the newest release, so you never change that link again.
- **iOS:** it can't install apps this way. iPhones only get updates from the App Store or TestFlight.

### Rules the system depends on (never break these)

| Rule | Why |
|---|---|
| The APK file must be named exactly **`daily-strip.apk`** | The app and the website download that file name |
| The tag must be **`v` + the version in app.json** (e.g. `v1.2.0`) | That's how the app compares versions |
| The release must **not** be a draft or pre-release | GitHub's "latest release" skips those |
| Always build with the **`preview`** profile on EAS | It makes an APK, raises the build number, and signs with your same key |
| The version must always go **up** | Android refuses to install an older version over a newer one |

---

## 2. What to do every time you change the app

### Step 1: Make your changes and test them
```bash
npx expo start
```
Open the app on your phone (Expo Go or a development build) and check that everything works.

### Step 2: Check for errors
```bash
npx tsc --noEmit
npx expo lint
```
Both must finish with no errors.

### Step 3: Did you add new data fields to Firestore?
If you save a **new field** (e.g. a new setting on the profile), add it to `firestore.rules` and deploy the rules:
```bash
firebase deploy --only firestore:rules
```
If you skip this, users get **"Couldn't save"**. If you didn't add fields, skip this step.

### Step 4: Raise the version number
Open `app.json` and change `"version"`:

| What changed | Example | Which number |
|---|---|---|
| Small fix (bug, typo, colour) | 1.1.0 → **1.1.1** | last number |
| New feature or screen | 1.1.0 → **1.2.0** | middle number (set the last to 0) |
| Huge redesign | 1.1.0 → **2.0.0** | first number |

You never need to touch the build number (`versionCode`). EAS raises it for you on every build.

### Step 5: Save your work in git
```bash
git add -A
git commit -m "Version 1.2.0: what you changed"
git push
```

### Step 6: Build the APK in the cloud
```bash
npx eas-cli@latest build -p android --profile preview
```
- It takes about 10 to 20 minutes, and the terminal shows a link where you can watch the build.
- When it's done, open the link and click **Download** to get the `.apk` file.

### Step 7: Rename the file
Rename the downloaded file (something like `application-xxxx.apk`) to exactly:
```
daily-strip.apk
```

### Step 8: Publish the release on GitHub
**Option A: with one command.** Run it in the folder where `daily-strip.apk` is, and change the version and notes:
```bash
gh release create v1.2.0 daily-strip.apk --repo Ashan-Iduranga/daily-strip-releases --title "Daily Strip 1.2.0" --notes "- New: monthly report screen
- Fixed: budget bar colour in dark mode"
```

**Option B: on the website.**
1. Go to https://github.com/Ashan-Iduranga/daily-strip-releases/releases/new
2. **Choose a tag** → type `v1.2.0` → **Create new tag**
3. **Title:** `Daily Strip 1.2.0`
4. **Description:** what's new, one line per change (users see this text in the app)
5. Drag `daily-strip.apk` into the attachments box and wait for it to finish uploading
6. Leave **"Set as a pre-release"** unticked, and keep **"Set as the latest release"** ticked
7. Click **Publish release**

### Step 9: Check it worked
- Open https://github.com/Ashan-Iduranga/daily-strip-releases/releases/latest/download/daily-strip.apk in a browser. It should start downloading the APK.
- On your phone, users see the update **within 24 hours** of opening the app. The app checks once a day.
- **To see it right now (testing only):** make sure the phone is **online and the app has synced**, then go to phone **Settings → Apps → Daily Strip → Storage → Clear storage**, and open the app again. You'll sign in again, and your data comes back from your account. (Don't do this while offline: changes not yet synced would be lost.)
- Tap the banner → **Update** → wait for the download → **Install**. The app reopens on the new version.

That's it. 🎉

---

## 3. The very first time on a new phone
People who don't have the app yet (or have a version older than 1.1.0) install it by hand once:
1. On the phone, open the landing page or https://github.com/Ashan-Iduranga/daily-strip-releases/releases/latest
2. Download `daily-strip.apk` and open it
3. If Android asks, allow **"Install unknown apps"** for the browser, then tap **Install**

After that, every new version arrives inside the app.

---

## 4. When something goes wrong

| Problem | What it means | Fix |
|---|---|---|
| **"App not installed"** / "conflicts with an existing package" | The new APK has a lower build number, or a different signing key | Always build with `--profile preview` on EAS (same key, build number goes up). Never install a build made another way over it |
| **No update banner** | Tag doesn't match, release is a draft or pre-release, or the phone checked less than 24h ago | Check the tag is `v` + app.json version and is higher than the phone's version. Wait a day, or see Step 9 |
| **"Couldn't download the update"** | No internet, or the file isn't named `daily-strip.apk` | Check the asset name on the release page. Edit the release and re-upload the file with the right name |
| **Android says installs from Daily Strip aren't allowed** | First update on that phone | Tap **Settings** on that message → turn on **Allow from this source** → go back → **Install** |
| **"Couldn't save" after updating** | New Firestore field, rules not deployed | Do Step 3 |
| **Build fails on EAS** | Usually a dependency issue | Run `npx expo-doctor` and `npx expo install --fix`, then build again |

---

## 5. Where the update code is (for reference)

| File | What it does |
|---|---|
| `src/constants/release.ts` | Which GitHub repo the app checks |
| `src/lib/update-check.ts` | Checks for a newer version once a day |
| `src/lib/apk-install.ts` | Downloads the APK and opens Android's installer |
| `src/components/update-sheet.tsx` | The update sheet (notes, progress bar, Install button) |
| `eas.json` → `preview` | Builds an APK and raises the build number automatically |
| `../landing page/lib/release.ts` | The website's download link (same repo) |
