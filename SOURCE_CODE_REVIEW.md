# Currency Lens source review

The Firefox source archive contains the minimal pnpm workspace needed to reproduce the submitted extension.
It does not require or read any `.env` file.

Prerequisites:

- Node.js 24
- Corepack

From the extracted archive root, run:

```text
corepack pnpm@11.24.0 install --frozen-lockfile
API_ENDPOINT=https://cl.dryk.net corepack pnpm@11.24.0 --filter @cl/browser-extension build:firefox
```

The unpacked extension is written to `apps/browser-extension/.output/firefox-mv3`.
The project uses WXT, React, Zustand, TanStack Router, Tailwind CSS, copied shadcn/ui components, and TypeScript.
The committed TanStack Router route tree is regenerated only from the included local route files; no generated source is fetched at build time.
