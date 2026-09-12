/**
 * Shared constants for the Fajr Alarm APK distribution.
 * The APK itself is built from the native Android project in `/android`
 * via GitHub Actions, and published as a GitHub Release asset.
 */

export const GITHUB_OWNER = "y5747m-gif";
export const GITHUB_REPO = "moslm-we-bas-";
export const APK_ASSET_NAME = "fajr-alarm.apk";
export const APP_VERSION = "1.0.0";
export const APP_PACKAGE = "com.fajrwake.alarm";

export const RELEASES_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
export const LATEST_DOWNLOAD_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/${APK_ASSET_NAME}`;
export const LATEST_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

/** Allow overriding the download URL via env (e.g. direct CDN hosting). */
export function getApkDownloadUrl(): string {
  const fromEnv = process.env.APK_DOWNLOAD_URL?.trim();
  if (fromEnv) return fromEnv;
  return LATEST_DOWNLOAD_URL;
}
