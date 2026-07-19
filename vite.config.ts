import { defineConfig } from "vite-plus";

const MAX_CYCLOMATIC_COMPLEXITY = 12;
const TEST_API_ENDPOINT = "https://cl.dryk.net";
const SECRET_FILE_PATTERNS = [
  ".env",
  ".env.*",
  ".dev.vars",
  ".dev.vars.*",
  "**/.env",
  "**/.env.*",
  "**/.dev.vars",
  "**/.dev.vars.*",
] as const;

/**
 * Centralizes formatting, strict static analysis, type checking, and tests for
 * every workspace package while WXT and Wrangler remain the build owners.
 */
export default defineConfig({
  // Repository commands never load local environment files. Runtime secrets belong to deployment boundaries.
  envDir: false,
  define: {
    "import.meta.env.API_ENDPOINT": JSON.stringify(TEST_API_ENDPOINT),
  },
  fmt: {
    ignorePatterns: [
      ...SECRET_FILE_PATTERNS,
      ".agents/**",
      "**/.output/**",
      "**/.wxt/**",
      "**/coverage/**",
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
      "**/.wxt/**",
      "**/coverage/**",
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
          "vitest/expect-expect": "error",
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
        files: [
          "apps/browser-extension/lib/currency-detection.ts",
          "apps/browser-extension/entrypoints/content/App.tsx",
          "apps/browser-extension/entrypoints/popup/App.tsx",
        ],
        rules: {
          complexity: ["error", 21],
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
    coverage: {
      exclude: [
        "**/.output/**",
        "**/.wxt/**",
        "**/dist/**",
        "apps/server/worker-configuration.d.ts",
        "packages/currency/src/index.ts",
      ],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
    },
    environment: "node",
    include: ["apps/**/*.{spec,test}.{ts,tsx}", "packages/**/*.{spec,test}.{ts,tsx}"],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
