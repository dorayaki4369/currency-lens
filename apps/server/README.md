# Cloudflare workers server

The server application is built using Cloudflare Workers and the Hono framework.
The project overview and development workflow are described in the [root README.md](../../README.md).

## Overview

The server fetches the latest exchange rates from Open Exchange Rates (OXR) and serves them to the browser extension.

## Development commands

```bash
pnpm srv dev      # Local development with scheduled tasks
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```bash
pnpm srv cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```
