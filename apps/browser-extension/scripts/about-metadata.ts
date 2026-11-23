import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/** Open source notice for one package shipped inside the extension. */
export interface ThirdPartyLicense {
  readonly license: string;
  readonly licenseText: string | null;
  readonly name: string;
  readonly version: string;
}

/** A development package whose code still ships, listed without its build-only dependencies. */
export interface AdditionalPackage {
  readonly name: string;
  /** Dependencies of this package that its shipped code imports; these are walked fully. */
  readonly runtimeDependencies?: readonly string[] | undefined;
}

interface CollectThirdPartyLicensesOptions {
  readonly additionalPackages?: readonly AdditionalPackage[] | undefined;
}

/** Vite plugin hooks used here, typed locally so both WXT's and Vitest's Vite accept it. */
export interface AboutMetadataVitePlugin {
  readonly name: string;
  readonly load: (id: string) => string | null;
  readonly resolveId: (id: string) => string | null;
}

interface PackageManifest {
  readonly dependencies: Readonly<Record<string, string>>;
  readonly license: string;
  readonly name: string;
  readonly optionalDependencies: Readonly<Record<string, string>>;
  readonly version: string;
}

export const EXTENSION_VERSION_MODULE_ID = "virtual:extension-version";
export const THIRD_PARTY_LICENSES_MODULE_ID = "virtual:third-party-licenses";
const VIRTUAL_MODULE_IDS: ReadonlySet<string> = new Set([
  EXTENSION_VERSION_MODULE_ID,
  THIRD_PARTY_LICENSES_MODULE_ID,
]);
const UNKNOWN_LICENSE = "UNKNOWN";
const LICENSE_FILE_PATTERN = /^(?:licen[cs]e|copying)(?:[.-].*)?$/iu;

/**
 * Development packages whose code ships: components/ui copies shadcn/ui sources, Tailwind CSS
 * emits its preflight into the stylesheet, and WXT bundles its entrypoint wrappers and the
 * Shadow DOM UI used by the content script, which import only the listed runtime dependencies.
 */
export const BUNDLED_BUILD_PACKAGES: readonly AdditionalPackage[] = [
  { name: "shadcn" },
  { name: "tailwindcss" },
  {
    name: "wxt",
    runtimeDependencies: [
      "@1natsu/wait-element",
      "@webext-core/isolated-element",
      "@webext-core/match-patterns",
      "@wxt-dev/browser",
    ],
  },
];

/**
 * Exposes the extension version and the shipped third-party licenses to popup code as
 * virtual modules. Licenses are computed on first import, so builds without the route skip it.
 */
export function aboutMetadataPlugin(packageRoot: string): AboutMetadataVitePlugin {
  return {
    name: "currency-lens:about-metadata",
    resolveId: (id) => (VIRTUAL_MODULE_IDS.has(id) ? `\0${id}` : null),
    load: (id) => {
      if (id === `\0${EXTENSION_VERSION_MODULE_ID}`) {
        return `export default ${JSON.stringify(readPackageManifest(packageRoot).version)};`;
      }
      if (id === `\0${THIRD_PARTY_LICENSES_MODULE_ID}`) {
        const licenses = collectThirdPartyLicenses(packageRoot, {
          additionalPackages: BUNDLED_BUILD_PACKAGES,
        });
        return `export default ${JSON.stringify(licenses)};`;
      }
      return null;
    },
  };
}

/**
 * Walks runtime dependencies from the package root with Node resolution and returns their
 * notices sorted by name. Workspace packages are traversed but not listed as third parties.
 */
export function collectThirdPartyLicenses(
  packageRoot: string,
  options: CollectThirdPartyLicensesOptions = {},
): ThirdPartyLicense[] {
  const visitedDirectories = new Set<string>();
  const licenses = new Map<string, ThirdPartyLicense>();

  const visit = (packageDirectory: string, listed: boolean, traverse: boolean): void => {
    if (visitedDirectories.has(packageDirectory)) {
      return;
    }
    visitedDirectories.add(packageDirectory);
    const manifest = readPackageManifest(packageDirectory);
    if (listed) {
      licenses.set(`${manifest.name}@${manifest.version}`, {
        license: manifest.license,
        licenseText: readLicenseText(packageDirectory),
        name: manifest.name,
        version: manifest.version,
      });
    }
    if (!traverse) {
      return;
    }
    for (const [name, specifier] of Object.entries(manifest.dependencies)) {
      if (name.startsWith("@types/")) {
        continue;
      }
      const dependencyDirectory = requirePackageDirectory(packageDirectory, name);
      visit(dependencyDirectory, !specifier.startsWith("workspace:"), true);
    }
    for (const name of Object.keys(manifest.optionalDependencies)) {
      const dependencyDirectory = resolvePackageDirectory(packageDirectory, name);
      if (dependencyDirectory !== null) {
        visit(dependencyDirectory, true, true);
      }
    }
  };

  const rootDirectory = realpathSync(packageRoot);
  visit(rootDirectory, false, true);
  for (const { name, runtimeDependencies = [] } of options.additionalPackages ?? []) {
    const packageDirectory = requirePackageDirectory(rootDirectory, name);
    visit(packageDirectory, true, false);
    for (const dependency of runtimeDependencies) {
      visit(requirePackageDirectory(packageDirectory, dependency), true, true);
    }
  }

  return [...licenses.values()].toSorted(
    (left, right) =>
      compareText(left.name, right.name) || compareText(left.version, right.version),
  );
}

/** Reads only the manifest fields needed for notices, tolerating legacy license shapes. */
function readPackageManifest(packageDirectory: string): PackageManifest {
  const value: unknown = JSON.parse(
    readFileSync(join(packageDirectory, "package.json"), "utf8"),
  );
  const record = isRecord(value) ? value : {};
  const name = record["name"];
  const version = record["version"];
  return {
    dependencies: readStringRecord(record["dependencies"]),
    license: readLicense(record),
    name: typeof name === "string" ? name : basename(packageDirectory),
    optionalDependencies: readStringRecord(record["optionalDependencies"]),
    version: typeof version === "string" ? version : "0.0.0",
  };
}

/** Normalizes SPDX strings, `{ type }` objects, and the deprecated `licenses` array. */
function readLicense(record: Readonly<Record<string, unknown>>): string {
  const license = record["license"];
  if (typeof license === "string") {
    return license;
  }
  if (isRecord(license) && typeof license["type"] === "string") {
    return license["type"];
  }
  const legacyLicenses = record["licenses"];
  if (Array.isArray(legacyLicenses)) {
    const types = legacyLicenses.flatMap((entry: unknown) =>
      isRecord(entry) && typeof entry["type"] === "string" ? [entry["type"]] : [],
    );
    if (types.length > 0) {
      return types.length === 1 ? types.join("") : `(${types.join(" OR ")})`;
    }
  }
  return UNKNOWN_LICENSE;
}

/** Returns the first license-like file in the package root, which holds the copyright notice. */
function readLicenseText(packageDirectory: string): string | null {
  const filename = readdirSync(packageDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && LICENSE_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .toSorted(compareText)[0];
  return filename === undefined
    ? null
    : readFileSync(join(packageDirectory, filename), "utf8").trim();
}

/** Resolves a dependency that the manifest requires, failing the build when it is missing. */
function requirePackageDirectory(fromDirectory: string, name: string): string {
  const directory = resolvePackageDirectory(fromDirectory, name);
  if (directory === null) {
    throw new Error(`Cannot resolve ${name} from ${fromDirectory} to collect its license.`);
  }
  return directory;
}

/** Applies Node's node_modules lookup so pnpm's isolated layout resolves each version. */
function resolvePackageDirectory(fromDirectory: string, name: string): string | null {
  let directory = fromDirectory;
  for (;;) {
    const candidate =
      basename(directory) === "node_modules"
        ? join(directory, name)
        : join(directory, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) {
      return realpathSync(candidate);
    }
    const parent = dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
}

/** Keeps only string values from a dependency map read from an untyped manifest. */
function readStringRecord(value: unknown): Readonly<Record<string, string>> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/** Narrows parsed JSON to a plain object. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Orders text by code point so the output does not depend on the build machine's locale. */
function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}
