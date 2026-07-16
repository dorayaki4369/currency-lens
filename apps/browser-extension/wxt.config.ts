import { defineConfig } from "wxt";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  manifestVersion: 3,
  targetBrowsers: ["chrome", "firefox"],
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  autoIcons: {
    developmentIndicator: false,
  },
  // Vite must never discover project-local environment files during an Agent build.
  vite: () => ({ envDir: false }),
  manifest: {
    name: "Currency Lens",
    description:
      "Convert selected prices into your favorite currencies without leaving the page.",
    permissions: ["storage", "alarms"],
    host_permissions: ["https://cl.dryk.net/*"],
    browser_specific_settings: {
      gecko: {
        data_collection_permissions: {
          required: ["none"],
        },
        id: "currency-lens@dryk.net",
        strict_min_version: "128.0",
      },
    },
  },
  zip: {
    sourcesRoot: repositoryRoot,
    excludeSources: ["**/*"],
    includeSources: [
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "tsconfig.base.json",
      "vite.config.ts",
      "apps/browser-extension/package.json",
      "apps/browser-extension/scripts/**",
      "apps/browser-extension/tsconfig.json",
      "apps/browser-extension/wxt.config.ts",
      "apps/browser-extension/SOURCE_CODE_REVIEW.md",
      "apps/browser-extension/assets/**",
      "apps/browser-extension/entrypoints/**",
      "apps/browser-extension/lib/**",
      "packages/currency/package.json",
      "packages/currency/tsconfig.json",
      "packages/currency/src/**",
    ],
  },
});
