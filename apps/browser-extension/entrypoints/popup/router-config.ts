import type { Config as TanStackRouterConfig } from "@tanstack/router-plugin/vite";

interface PopupRouterPaths {
  readonly generatedRouteTree: string;
  readonly routesDirectory: string;
  readonly temporaryDirectory: string;
}

/** Keeps WXT and browser-test route generation on the same splitting contract. */
export function createPopupRouterPluginOptions(paths: PopupRouterPaths) {
  return {
    autoCodeSplitting: true,
    generatedRouteTree: paths.generatedRouteTree,
    quoteStyle: "double",
    routeFileIgnorePattern: "\\.test\\.",
    routesDirectory: paths.routesDirectory,
    semicolons: true,
    tmpDir: paths.temporaryDirectory,
  } satisfies Partial<TanStackRouterConfig>;
}
