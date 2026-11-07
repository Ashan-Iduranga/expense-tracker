/**
 * Where new versions of the app are published: GitHub Releases on a public repo (the code repo is private).
 * Upload each build as a release asset named `daily-strip.apk`, tagged `v<app.json version>`.
 * Keep the website's lib/release.ts in step.
 */
export const RELEASE_REPO = 'Ashan-Iduranga/daily-strip-releases';

/** Always the newest release's APK. */
export const APK_URL = `https://github.com/${RELEASE_REPO}/releases/latest/download/daily-strip.apk`;

export const RELEASES_API = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;
