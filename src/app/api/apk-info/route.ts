import { NextResponse } from "next/server";
import {
  APK_ASSET_NAME,
  APP_PACKAGE,
  APP_VERSION,
  LATEST_API_URL,
  RELEASES_PAGE,
  getApkDownloadUrl,
} from "@/lib/apk";

export const revalidate = 300; // cache for 5 minutes

type ApkInfo = {
  version: string;
  package: string;
  assetName: string;
  downloadUrl: string;
  releasesPage: string;
  sizeBytes: number | null;
  sizeLabel: string | null;
  publishedAt: string | null;
  available: boolean;
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} م.ب`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} ك.ب`;
}

export async function GET() {
  const fallback: ApkInfo = {
    version: APP_VERSION,
    package: APP_PACKAGE,
    assetName: APK_ASSET_NAME,
    downloadUrl: getApkDownloadUrl(),
    releasesPage: RELEASES_PAGE,
    sizeBytes: null,
    sizeLabel: null,
    publishedAt: null,
    available: false,
  };

  try {
    const res = await fetch(LATEST_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "fajr-alarm-site",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json(fallback);
    }
    const data = (await res.json()) as {
      tag_name?: string;
      published_at?: string;
      assets?: Array<{ name?: string; size?: number; browser_download_url?: string }>;
    };
    const asset = data.assets?.find((a) => a.name === APK_ASSET_NAME);
    if (!asset?.browser_download_url) {
      return NextResponse.json(fallback);
    }
    const info: ApkInfo = {
      version: (data.tag_name ?? APP_VERSION).replace(/^v/, ""),
      package: APP_PACKAGE,
      assetName: APK_ASSET_NAME,
      downloadUrl: process.env.APK_DOWNLOAD_URL?.trim() || asset.browser_download_url,
      releasesPage: RELEASES_PAGE,
      sizeBytes: asset.size ?? null,
      sizeLabel: asset.size ? formatBytes(asset.size) : null,
      publishedAt: data.published_at ?? null,
      available: true,
    };
    return NextResponse.json(info);
  } catch {
    return NextResponse.json(fallback);
  }
}
