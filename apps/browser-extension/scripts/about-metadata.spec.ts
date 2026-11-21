import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  aboutMetadataPlugin,
  BUNDLED_BUILD_PACKAGES,
  collectThirdPartyLicenses,
  EXTENSION_VERSION_MODULE_ID,
  THIRD_PARTY_LICENSES_MODULE_ID,
} from "@/scripts/about-metadata.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("third-party license collection", () => {
  it("walks runtime dependencies through nested node_modules and sorts by name and version", () => {
    const root = createWorkspace();
    writePackage(root, {
      name: "app",
      dependencies: { "@scope/b": "^1", a: "^2", "@types/skip": "^1" },
    });
    writePackage(join(root, "node_modules/a"), {
      name: "a",
      version: "2.0.0",
      license: "MIT",
      dependencies: { "@scope/b": "^0" },
    });
    writeFileSync(join(root, "node_modules/a/LICENSE"), "  MIT text for a  \n");
    writePackage(join(root, "node_modules/a/node_modules/@scope/b"), {
      name: "@scope/b",
      version: "0.9.0",
      license: { type: "ISC" },
    });
    writeFileSync(join(root, "node_modules/a/node_modules/@scope/b/licence.md"), "old b");
    writeFileSync(join(root, "node_modules/a/node_modules/@scope/b/LICENSE-MIT"), "never");
    writePackage(join(root, "node_modules/@scope/b"), {
      name: "@scope/b",
      version: "1.0.0",
      licenses: [{ type: "MIT" }, { type: "Apache-2.0" }],
    });
    mkdirSync(join(root, "node_modules/@scope/b/license"));

    expect(collectThirdPartyLicenses(root)).toEqual([
      { license: "ISC", licenseText: "never", name: "@scope/b", version: "0.9.0" },
      {
        license: "(MIT OR Apache-2.0)",
        licenseText: null,
        name: "@scope/b",
        version: "1.0.0",
      },
      { license: "MIT", licenseText: "MIT text for a", name: "a", version: "2.0.0" },
    ]);
  });

  it("traverses workspace packages without listing them and skips missing optional packages", () => {
    const root = createWorkspace();
    writePackage(join(root, "apps/app"), {
      name: "app",
      dependencies: { "@local/shared": "workspace:*" },
    });
    writePackage(join(root, "node_modules/@local/shared"), {
      name: "@local/shared",
      dependencies: { leaf: "^1" },
      optionalDependencies: { absent: "^1", present: "^1", invalid: 1 },
    });
    writePackage(join(root, "node_modules/leaf"), {
      name: "leaf",
      version: "1.0.0",
      licenses: [{ type: "BSD-3-Clause" }],
    });
    writePackage(join(root, "node_modules/present"), { version: "3.0.0" });

    expect(collectThirdPartyLicenses(join(root, "apps/app"))).toEqual([
      { license: "BSD-3-Clause", licenseText: null, name: "leaf", version: "1.0.0" },
      { license: "UNKNOWN", licenseText: null, name: "present", version: "3.0.0" },
    ]);
  });

  it("lists additional packages without their dependencies", () => {
    const root = createWorkspace();
    writePackage(root, { name: "app" });
    writePackage(join(root, "node_modules/css"), {
      name: "css",
      version: "4.0.0",
      license: "MIT",
      dependencies: { "build-only": "^1" },
    });

    expect(collectThirdPartyLicenses(root, { additionalPackages: ["css"] })).toEqual([
      { license: "MIT", licenseText: null, name: "css", version: "4.0.0" },
    ]);
  });

  it("reports malformed manifests as unknown instead of guessing", () => {
    const root = createWorkspace();
    writePackage(root, { name: "app", dependencies: { odd: "^1", empty: "^1" } });
    mkdirSync(join(root, "node_modules/odd"), { recursive: true });
    writeFileSync(join(root, "node_modules/odd/package.json"), "[]");
    writePackage(join(root, "node_modules/empty"), {
      name: "empty",
      version: "1.0.0",
      licenses: [{ name: "no type" }],
      dependencies: [],
    });

    expect(collectThirdPartyLicenses(root)).toEqual([
      { license: "UNKNOWN", licenseText: null, name: "empty", version: "1.0.0" },
      { license: "UNKNOWN", licenseText: null, name: "odd", version: "0.0.0" },
    ]);
  });

  it("fails the build when a required dependency cannot be resolved", () => {
    const root = createWorkspace();
    writePackage(root, { name: "app", dependencies: { missing: "^1" } });

    expect(() => collectThirdPartyLicenses(root)).toThrow(
      `Cannot resolve missing from ${root} to collect its license.`,
    );
  });

  it("collects the extension's shipped packages from the real dependency tree", () => {
    const licenses = collectThirdPartyLicenses(
      fileURLToPath(new URL("..", import.meta.url)),
      {
        additionalPackages: BUNDLED_BUILD_PACKAGES,
      },
    );
    const names = licenses.map((entry) => entry.name);

    expect(names).toEqual(
      expect.arrayContaining(["react", "react-dom", "zod", "tailwindcss", "shadcn"]),
    );
    expect(names).not.toContain("@cl/currency");
    expect(names.some((name) => name.startsWith("@types/"))).toBe(false);
  });
});

describe("about metadata Vite plugin", () => {
  it("serves the extension version and licenses as virtual modules", () => {
    const root = createWorkspace();
    writePackage(root, { name: "app", version: "9.8.7", dependencies: { a: "^1" } });
    writePackage(join(root, "node_modules/a"), { name: "a", version: "1.0.0" });
    for (const name of BUNDLED_BUILD_PACKAGES) {
      writePackage(join(root, "node_modules", name), { name, version: "1.0.0" });
    }
    const plugin = aboutMetadataPlugin(root);
    const resolvedId = plugin.resolveId(THIRD_PARTY_LICENSES_MODULE_ID);

    expect(plugin.load(plugin.resolveId(EXTENSION_VERSION_MODULE_ID) ?? "")).toBe(
      'export default "9.8.7";',
    );
    expect(resolvedId).toBe(`\0${THIRD_PARTY_LICENSES_MODULE_ID}`);
    expect(plugin.resolveId("react")).toBeNull();
    expect(plugin.load("react")).toBeNull();
    expect(plugin.load(resolvedId ?? "")).toBe(
      `export default ${JSON.stringify(
        ["a", ...BUNDLED_BUILD_PACKAGES].map((name) => ({
          license: "UNKNOWN",
          licenseText: null,
          name,
          version: "1.0.0",
        })),
      )};`,
    );
  });
});

/** Creates an isolated directory tree that mimics node_modules layouts. */
function createWorkspace(): string {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "about-metadata-")));
  temporaryDirectories.push(directory);
  return directory;
}

/** Writes a package manifest, creating its directory first. */
function writePackage(
  directory: string,
  manifest: Readonly<Record<string, unknown>>,
): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "package.json"), JSON.stringify(manifest));
}
