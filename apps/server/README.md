# Cloudflare workers server

The server application is built using Cloudflare Workers.
The project overview and development workflow are described in the [root README.md](../../README.md).

## Overview

The server fetches the latest exchange rates from Open Exchange Rates (OXR) and serves them to the browser extension.

## Local development

```bash
# Local development with scheduled tasks
pnpm srv dev
```

the scheduled tasks can be tested locally using a http request

```bash
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

## Generating types

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```bash
pnpm srv typegen
```
