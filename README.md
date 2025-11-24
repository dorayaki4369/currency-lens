# Currency Lens

A browser extension for converting the currency to your favorite currency.

## Features

- Converts prices on web pages to your preferred currency
- Able to exchange between 200+ currencies including cryptocurrencies
- Uses latest exchange rates from [Open Exchange Rates](https://openexchangerates.org)

## How to use

Install the extension from the [Chrome Web Store](https://chrome.google.com/webstore/detail/currency-lens/cfpmgblhfmfomcgkpkghcgkcfblbpgkm) or [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/currency-lens).

## For developers

### Setup

Please execute `pnpm install` to install dependencies and build packages.
After that, `apps/server/.dev.vars` file should have been created, so set your Open Exchange Rates App ID there:

```env
OPEN_EXCHANGE_RATE_APP_ID=your_app_id_here
```

### Commands

```bash
pnpm install              # Install dependencies (also runs postinstall build)

pnpm bex dev              # Development mode (Chrome)
pnpm bex dev:firefox      # Development mode (Firefox)

pnpm srv dev              # Local development with scheduled tasks

pnpm format               # Format code
pnpm lint                 # Lint code
pnpm typecheck            # Type-check all packages and apps

pnpm build                # Build all packages and apps

pnpm deploy
```

### Folder Structure

This project is a pnpm monorepo with apps and packages directories.
Each app/package has its own README with more details.

```text
.
├── apps
|   ├── browser-extension      WXT-based browser extension
│   └── server                 Cloudflare Workers API (Hono framework)
└── packages
    ├── currency               Currency metadata (codes, symbols, decimals)
    └── oxr                    Type-safe Open Exchange Rates(OXR) API client`
```
