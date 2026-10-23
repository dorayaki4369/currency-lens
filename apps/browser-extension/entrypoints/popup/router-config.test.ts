import { describe, expect, it } from "vitest";
import { createPopupRouterPluginOptions } from "@/entrypoints/popup/router-config";

describe("popup router plugin configuration", () => {
  it("enables route splitting while preserving caller-owned paths", () => {
    expect(
      createPopupRouterPluginOptions({
        generatedRouteTree: "generated.ts",
        routesDirectory: "routes",
        temporaryDirectory: "temporary",
      }),
    ).toEqual({
      autoCodeSplitting: true,
      generatedRouteTree: "generated.ts",
      quoteStyle: "double",
      routeFileIgnorePattern: "\\.test\\.",
      routesDirectory: "routes",
      semicolons: true,
      tmpDir: "temporary",
    });
  });
});
