import { fileURLToPath } from "node:url";
import { defineConfig, type ConfigEnv, type UserManifest, type WxtViteConfig } from "wxt";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const API_ENDPOINT_VARIABLE = "API_ENDPOINT";
const LOCAL_HTTP_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

export default defineConfig({
  manifestVersion: 3,
  targetBrowsers: ["chrome", "firefox"],
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  autoIcons: {
    developmentIndicator: false,
  },
  vite: createViteConfig,
  manifest: createManifest,
  zip: {
    sourcesRoot: repositoryRoot,
    excludeSources: ["**/*"],
    includeSources: [
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "tsconfig.base.json",
      "vite.config.ts",
      "apps/browser-extension/env.d.ts",
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

/** Creates a manifest whose host permission exactly matches the configured API. */
export function createManifest(
  _env: Readonly<ConfigEnv>,
  configuredApiEndpoint: string | undefined = process.env[API_ENDPOINT_VARIABLE],
): UserManifest {
  const apiEndpoint = resolveApiEndpoint(configuredApiEndpoint);

  return {
    name: "Currency Lens",
    description:
      "Convert selected prices into your favorite currencies without leaving the page.",
    permissions: ["storage", "alarms"],
    host_permissions: [createApiHostPermission(apiEndpoint)],
    browser_specific_settings: {
      gecko: {
        data_collection_permissions: {
          required: ["none"],
        },
        id: "currency-lens@dryk.net",
        strict_min_version: "128.0",
      },
    },
  };
}

/** Injects the validated API base URL while keeping environment-file discovery disabled. */
export function createViteConfig(
  _env: Readonly<ConfigEnv>,
  configuredApiEndpoint: string | undefined = process.env[API_ENDPOINT_VARIABLE],
): WxtViteConfig {
  const apiEndpoint = resolveApiEndpoint(configuredApiEndpoint);

  return {
    envDir: false,
    define: {
      "import.meta.env.API_ENDPOINT": JSON.stringify(apiEndpoint),
    },
  };
}

/** Validates and normalizes the API base URL shared by development and production builds. */
export function resolveApiEndpoint(configuredApiEndpoint: string | undefined): string {
  const endpoint = configuredApiEndpoint?.trim();
  if (endpoint === undefined || endpoint === "") {
    throw new Error(
      `${API_ENDPOINT_VARIABLE} is required. Configure it for local development or the production build environment.`,
    );
  }

  return validateApiEndpoint(endpoint);
}

/** Accepts HTTPS endpoints and loopback HTTP endpoints without embedded credentials or fragments. */
function validateApiEndpoint(endpoint: string): string {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (error) {
    throw new Error(`${API_ENDPOINT_VARIABLE} must be an absolute URL.`, {
      cause: error,
    });
  }

  const isHttps = url.protocol === "https:";
  const isLocalHttp = url.protocol === "http:" && LOCAL_HTTP_HOSTS.has(url.hostname);
  if (!isHttps && !isLocalHttp) {
    throw new Error(`${API_ENDPOINT_VARIABLE} must use HTTPS or HTTP on a loopback host.`);
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error(`${API_ENDPOINT_VARIABLE} must not contain credentials.`);
  }
  if (url.search !== "") {
    throw new Error(`${API_ENDPOINT_VARIABLE} must not contain query parameters.`);
  }
  if (url.hash !== "") {
    throw new Error(`${API_ENDPOINT_VARIABLE} must not contain a fragment.`);
  }

  return url.href.replace(/\/+$/, "");
}

/** Converts the API base URL to a WebExtension match pattern, which cannot include a port. */
function createApiHostPermission(endpoint: string): string {
  const url = new URL(endpoint);
  return `${url.protocol}//${url.hostname}/*`;
}
