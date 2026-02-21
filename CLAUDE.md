# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The overview of the project was written in the README.md file. Please refer to it for context about the project.
README.md contains information about the purpose of the project, its features, and development commands.

## Development workflow

### Implementation approach

1. **Understand the codebase first**:
   - Read relevant files to understand existing patterns and architecture
   - Use the Explore subagent for complex codebase exploration
   - Identify the appropriate location for new code

2. **When facing technical uncertainties**:
   - Use the Task tool with specialized subagents (Explore, Plan, etc.) to investigate
   - Research framework-specific patterns (WXT, Hono, Cloudflare Workers)
   - Check existing implementations in the codebase for reference

3. **Implement incrementally**:
   - Start with core functionality
   - Add error handling and edge cases
   - Ensure type safety throughout
   - Test changes in development mode

### After writing code

1. **Always run lint and format** after writing or modifying code
2. **Run typechecking** to ensure type safety
3. **Build and test** if you modified packages used by apps

### Coding conventions

- **Function decomposition**: Break down complex functions into smaller, focused functions
- **Type safety**: Always define proper TypeScript types, avoid using `any`
- **Monorepo awareness**:
  - This is a pnpm monorepo - always use `pnpm` as the package manager
  - When modifying shared packages (`packages/*`), rebuild them before testing in apps
  - Use workspace protocol for internal dependencies
- **Browser extension specifics**:
  - Follow WXT framework conventions
  - Keep content scripts lightweight
  - Use message passing for communication between contexts
- **Server specifics**:
  - Follow Cloudflare Workers best practices
  - Use Hono framework conventions
  - Be mindful of Worker runtime limitations
  - Pass `CloudflareBindings` as generics when instantiating Hono: `new Hono<{ Bindings: CloudflareBindings }>()`

## Project Structure

### Where to add code

- **Shared packages** (`packages/*`):
  - `packages/currency`: Currency metadata (codes, symbols, decimals)
  - `packages/oxr`: Type-safe OXR API client with Zod validation
  - Add new shared packages here when code needs to be used by multiple apps

- **Applications** (`apps/*`):
  - `apps/browser-extension`: WXT-based browser extension
    - `entrypoints/`: WXT entrypoints (popup, content scripts, background)
    - `lib/`: Extension-specific utilities
    - `schema/`: Extension-specific schemas
  - `apps/server`: Cloudflare Workers API
    - `src/`: Server source code
    - `.dev.vars`: Environment variables (DO NOT COMMIT)

### Adding dependencies

- Add shared dependencies to the root `package.json` only if truly needed across all packages
- Add package-specific dependencies to the respective `package.json`
- For internal dependencies, use workspace protocol: `"@currency-lens/oxr": "workspace:*"`
- After adding dependencies to shared packages, run `pnpm build` before testing

## Environment Variables and Secrets

- **Server environment variables**:
  - Use `.dev.vars` for local development (already in `.gitignore`)
  - Reference `.dev.vars.example` for required variables
  - For production, set secrets via Cloudflare dashboard or Wrangler CLI
  - NEVER commit `.dev.vars` or any files containing API keys/secrets

- **API Keys**:
  - `OPEN_EXCHANGE_RATE_APP_ID` is required for the server

## Security Considerations

- **API Keys**: Never hardcode API keys or secrets in code
- **User Data**: This is a browser extension with access to page content - be mindful of user privacy
- **Content Security Policy**: Follow CSP guidelines for browser extensions
- **Input Validation**: Always validate external data (API responses, user input) using Zod schemas
- **XSS Prevention**: Sanitize any content injected into web pages
