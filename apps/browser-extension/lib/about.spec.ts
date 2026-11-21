import { describe, expect, it } from "vitest";
import { getStoreReviewLink } from "@/lib/about";

describe("store review link", () => {
  it("points each build target at the store that distributes it", () => {
    expect(getStoreReviewLink("chrome")).toEqual({
      storeNameKey: "storeChrome",
      url: "https://chromewebstore.google.com/detail/cfpmgblhfmfomcgkpkghcgkcfblbpgkm/reviews",
    });
    expect(getStoreReviewLink("firefox")).toEqual({
      storeNameKey: "storeFirefox",
      url: "https://addons.mozilla.org/firefox/addon/currency-lens/",
    });
  });

  it("hides the link for targets without a store listing", () => {
    expect(getStoreReviewLink(undefined)).toBeNull();
    expect(getStoreReviewLink("safari")).toBeNull();
  });
});
