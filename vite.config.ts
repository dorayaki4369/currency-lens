import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite-plus";
import { getHeadlessChromiumLaunchArguments } from "./apps/browser-extension/test/chromium-launch";
import { browserIntegrationCommands } from "./apps/browser-extension/test/integration/browser-commands";
import {
  integrationPublicDir,
  integrationVitePlugins,
} from "./apps/browser-extension/test/integration/vite-plugins";

const MAX_CYCLOMATIC_COMPLEXITY = 12;
const TEST_API_ENDPOINT = "https://cl.dryk.net";
const BROWSER_EXTENSION_ROOT_URL = new URL("./apps/browser-extension/", import.meta.url);
const BROWSER_EXTENSION_ROOT = fileURLToPath(BROWSER_EXTENSION_ROOT_URL);
const SECRET_FILE_PATTERNS = [".env", ".dev.vars"] as const;
const E2E_TESTS = "apps/browser-extension/test/e2e/**";

/**
 * Centralizes formatting, strict static analysis, type checking, and tests for
 * every workspace package while WXT and Wrangler remain the build owners.
 */
export default defineConfig({
  // Repository commands never load local environment files. Runtime secrets belong to deployment boundaries.
  envDir: false,
  resolve: {
    alias: {
      "@": BROWSER_EXTENSION_ROOT,
    },
  },
  define: {
    "import.meta.env.API_ENDPOINT": JSON.stringify(TEST_API_ENDPOINT),
  },
  fmt: {
    ignorePatterns: [
      ...SECRET_FILE_PATTERNS,
      ".agents/**",
      "**/.output/**",
      "**/.deps/**",
      "**/.tmp/**",
      "**/.wxt/**",
      "**/coverage/**",
      "**/*.d.{ts,mts,cts}",
      "**/routeTree.gen.ts",
      "**/dist/**",
      "**/node_modules/**",
      "apps/server/worker-configuration.d.ts",
      "pnpm-lock.yaml",
    ],
    printWidth: 92,
    proseWrap: "preserve",
    semi: true,
    singleQuote: false,
    sortPackageJson: true,
    trailingComma: "all",
  },
  lint: {
    categories: {
      correctness: "error",
      suspicious: "error",
      perf: "error",
    },
    ignorePatterns: [
      ...SECRET_FILE_PATTERNS,
      ".agents/**",
      "**/.output/**",
      "**/.deps/**",
      "**/.tmp/**",
      "**/.wxt/**",
      "**/coverage/**",
      "**/*.d.{ts,mts,cts}",
      "**/routeTree.gen.ts",
      "**/dist/**",
      "**/node_modules/**",
      "apps/server/worker-configuration.d.ts",
    ],
    options: {
      denyWarnings: true,
      maxWarnings: 0,
      reportUnusedDisableDirectives: "error",
      typeAware: true,
      typeCheck: true,
    },
    plugins: ["typescript", "unicorn", "oxc", "import", "promise"],
    rules: {
      complexity: ["error", MAX_CYCLOMATIC_COMPLEXITY],
      "import/no-cycle": "error",
      "promise/no-nesting": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-misused-promises": "error",
      "typescript/no-unsafe-argument": "error",
      "typescript/no-unsafe-assignment": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/no-unsafe-member-access": "error",
      "typescript/no-unsafe-return": "error",
      "typescript/strict-boolean-expressions": "error",
      "typescript/switch-exhaustiveness-check": "error",
    },
    overrides: [
      {
        files: ["apps/browser-extension/**/*.tsx"],
        env: { browser: true },
        plugins: ["typescript", "unicorn", "oxc", "import", "promise", "react", "jsx-a11y"],
        rules: {
          "import/no-unassigned-import": "off",
          "react/jsx-filename-extension": "off",
          "react/react-in-jsx-scope": "off",
          "react-hooks/exhaustive-deps": "error",
          "react-hooks/rules-of-hooks": "error",
        },
      },
      {
        files: ["apps/browser-extension/**/*.{ts,tsx}"],
        env: { browser: true, webextensions: true },
      },
      {
        files: [
          "apps/browser-extension/components/**/*.{ts,tsx}",
          "apps/browser-extension/entrypoints/**/*.{ts,tsx}",
          "apps/browser-extension/lib/**/*.{ts,tsx}",
          "apps/browser-extension/stores/**/*.{ts,tsx}",
          "apps/browser-extension/test/**/*.{ts,tsx}",
          "apps/browser-extension/**/*.spec.{ts,tsx}",
        ],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              patterns: [
                {
                  group: ["./*", "../*"],
                  message: "Use the package-root @/ alias for internal imports.",
                },
              ],
            },
          ],
        },
      },
      {
        files: ["apps/server/**/*.ts"],
        env: { worker: true },
        rules: {
          "no-console": "off",
        },
      },
      {
        files: [
          "**/*.spec.{ts,tsx}",
          "**/*.test.{ts,tsx}",
          "apps/**/test/**/*.{ts,tsx}",
          "packages/**/test/**/*.{ts,tsx}",
        ],
        env: { browser: true, node: true },
        plugins: [
          "typescript",
          "unicorn",
          "oxc",
          "import",
          "promise",
          "react",
          "jsx-a11y",
          "vitest",
        ],
        rules: {
          "no-magic-numbers": "off",
          "typescript/no-unsafe-argument": "off",
          "typescript/no-unsafe-assignment": "off",
          "typescript/no-unsafe-member-access": "off",
          "typescript/no-unsafe-type-assertion": "off",
          "typescript/prefer-readonly-parameter-types": "off",
          "typescript/promise-function-async": "off",
          "typescript/require-await": "off",
          "vitest/expect-expect": ["error", { assertFunctionNames: ["expect", "expect*"] }],
          "vitest/no-disabled-tests": "error",
          "vitest/no-focused-tests": "error",
        },
      },
      {
        files: ["packages/currency/src/index.ts"],
        rules: {
          "max-lines": "off",
          "no-magic-numbers": "off",
        },
      },
      {
        files: ["*.config.ts", "apps/**/wxt.config.ts"],
        env: { node: true },
        rules: {
          "import/no-default-export": "off",
        },
      },
    ],
    settings: {
      react: { version: "19.2.7" },
    },
  },
  test: {
    exclude: ["**/.deps/**", "**/.tmp/**", "**/node_modules/**"],
    coverage: {
      exclude: [
        "**/.output/**",
        "**/.wxt/**",
        "**/dist/**",
        "**/*.d.{ts,mts,cts}",
        "**/routeTree.gen.ts",
        "**/*.{spec,test}.{ts,tsx,mjs}",
        "**/test/**",
        "apps/server/worker-configuration.d.ts",
      ],
      include: [
        "apps/browser-extension/components/**/*.{ts,tsx}",
        "apps/browser-extension/entrypoints/**/*.{ts,tsx}",
        "apps/browser-extension/lib/**/*.ts",
        "apps/browser-extension/scripts/**/*.{ts,mjs}",
        "apps/browser-extension/stores/**/*.{ts,tsx}",
        "apps/browser-extension/web-ext.config.ts",
        "apps/browser-extension/wxt.config.ts",
        "apps/server/src/**/*.ts",
        "packages/*/src/**/*.ts",
      ],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        perFile: true,
        statements: 100,
      },
    },
    passWithNoTests: false,
    projects: [
      {
        extends: true,
        test: {
          environment: "node",
          exclude: ["apps/browser-extension/test/integration/**", E2E_TESTS],
          include: ["apps/**/*.{spec,test}.{ts,tsx}", "packages/**/*.{spec,test}.{ts,tsx}"],
          name: "unit",
        },
      },
      {
        // Runs in real Chromium with the extension's build plugins,
        // so layout, motion, Shadow DOM, and axe checks see real CSS.
        cacheDir: fileURLToPath(
          new URL("./node_modules/.vite/integration", BROWSER_EXTENSION_ROOT_URL),
        ),
        envDir: false,
        optimizeDeps: {
          // Pre-bundling these up front prevents a mid-run reload from loading React twice.
          include: [
            "@testing-library/react",
            "axe-core",
            "react",
            "react-dom",
            "react-dom/client",
            "react/jsx-dev-runtime",
            "react/jsx-runtime",
          ],
        },
        plugins: integrationVitePlugins,
        publicDir: integrationPublicDir,
        resolve: {
          alias: {
            "@": BROWSER_EXTENSION_ROOT,
          },
        },
        root: BROWSER_EXTENSION_ROOT,
        test: {
          browser: {
            commands: browserIntegrationCommands,
            enabled: true,
            headless: true,
            instances: [{ browser: "chromium" }],
            provider: playwright({
              launchOptions: {
                args: getHeadlessChromiumLaunchArguments(),
                channel: "chromium-headless-shell",
              },
            }),
            screenshotFailures: false,
          },
          fileParallelism: false,
          include: ["test/integration/**/*.spec.{ts,tsx}"],
          name: "integration",
          restoreMocks: true,
          testTimeout: 60_000,
        },
      },
    ],
    restoreMocks: true,
  },
});
