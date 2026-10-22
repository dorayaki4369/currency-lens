import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { createPopupRouterPluginOptions } from "../../entrypoints/popup/router-config";

const browserExtensionRoot = fileURLToPath(new URL("../..", import.meta.url));
const popupRoot = resolve(browserExtensionRoot, "entrypoints/popup");

/** Serves flag icons where the browser stub resolves extension asset URLs. */
export const integrationPublicDir = resolve(
  browserExtensionRoot,
  "node_modules/flag-icons/flags",
);

/** Builds popup routes and Tailwind CSS the same way WXT does for the shipped extension. */
export const integrationVitePlugins = [
  tanstackRouter(
    createPopupRouterPluginOptions({
      generatedRouteTree: resolve(popupRoot, "routeTree.gen.ts"),
      routesDirectory: resolve(popupRoot, "routes"),
      temporaryDirectory: resolve(tmpdir(), "currency-lens-integration-tanstack-router"),
    }),
  ),
  tailwindcss(),
];
