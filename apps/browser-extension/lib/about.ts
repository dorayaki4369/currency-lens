import type { TranslationKey } from "@/lib/i18n";

export const APP_LICENSE = "MIT";
export const COPYRIGHT_NOTICE = "© 2026 Ryuya Hirayama";
export const PRIVACY_POLICY_URL = "https://cl.dryk.net/privacy";
export const RATE_SOURCE_NAME = "Open Exchange Rates";
export const RATE_SOURCE_URL = "https://openexchangerates.org/";
export const REPOSITORY_URL = "https://github.com/dorayaki4369/currency-lens";

const CHROME_REVIEW_URL =
  "https://chromewebstore.google.com/detail/cfpmgblhfmfomcgkpkghcgkcfblbpgkm/reviews";
// AMO shows the rating form on the listing page rather than the review list.
const FIREFOX_REVIEW_URL = "https://addons.mozilla.org/firefox/addon/currency-lens/";

export interface StoreReviewLink {
  readonly storeNameKey: Extract<TranslationKey, "storeChrome" | "storeFirefox">;
  readonly url: string;
}

/** Picks the store listing that distributed this build, or none for unknown targets. */
export function getStoreReviewLink(
  browserName: string | undefined,
): StoreReviewLink | null {
  if (browserName === "chrome") {
    return { storeNameKey: "storeChrome", url: CHROME_REVIEW_URL };
  }
  if (browserName === "firefox") {
    return { storeNameKey: "storeFirefox", url: FIREFOX_REVIEW_URL };
  }
  return null;
}
