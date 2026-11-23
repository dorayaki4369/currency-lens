interface ImportMetaEnv {
  readonly API_ENDPOINT: string;
}

declare module "virtual:third-party-licenses" {
  const licenses: readonly import("./scripts/about-metadata").ThirdPartyLicense[];
  export default licenses;
}

declare module "virtual:extension-version" {
  const version: string;
  export default version;
}
