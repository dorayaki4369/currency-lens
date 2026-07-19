# Currency Lens source review

The Firefox source archive contains the minimal pnpm workspace needed to reproduce the submitted extension.
It does not require or read any `.env` file.

Prerequisites:

- Node.js 24
- Corepack

From the extracted archive root, run:

```text
corepack pnpm@11.13.0 install --frozen-lockfile
corepack pnpm@11.13.0 --filter @cl/currency build
API_ENDPOINT=https://cl.dryk.net corepack pnpm@11.13.0 --filter @cl/browser-extension build:firefox
```

The unpacked extension is written to `apps/browser-extension/.output/firefox-mv3`.
The project uses WXT, React, plain CSS, and TypeScript; no generated source is fetched at build time.
