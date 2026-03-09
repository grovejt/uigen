# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (installs deps, generates Prisma client, runs migrations)
npm run setup

# Development server (uses Turbopack + node-compat.cjs polyfill)
npm run dev

# Build
npm run build

# Run all tests
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Lint
npm run lint

# Reset database
npm run db:reset

# Regenerate Prisma client after schema changes
npx prisma generate

# Run new migrations
npx prisma migrate dev
```

## Architecture

UIGen is a Next.js 15 (App Router) application that lets users describe React components in a chat interface and previews them live in-browser.

### Key Data Flow

1. User sends a message → `POST /api/chat` (`src/app/api/chat/route.ts`)
2. The route reconstructs a `VirtualFileSystem` from the serialized `files` payload, streams Claude's response using Vercel AI SDK's `streamText`, and provides two tools:
   - `str_replace_editor` — creates/edits files in the VFS
   - `file_manager` — renames/deletes files in the VFS
3. On finish, the updated VFS and messages are persisted to the SQLite `Project` model via Prisma (only for authenticated users)
4. The client-side `FileSystemContext` receives tool calls from the stream and applies them to the in-memory VFS, triggering re-renders
5. `PreviewFrame` takes the VFS file map, transforms JSX/TSX with Babel Standalone, builds an import map with blob URLs (third-party packages via `esm.sh`), and renders an iframe

### Virtual File System (`src/lib/file-system.ts`)

`VirtualFileSystem` is an in-memory tree of `FileNode` objects (no disk writes). It supports serialize/deserialize for persisting to the database as JSON. The context wrapper (`src/lib/contexts/file-system-context.tsx`) exposes the VFS to React components and handles tool call dispatching.

### AI Provider (`src/lib/provider.ts`)

If `ANTHROPIC_API_KEY` is set, uses `claude-haiku-4-5` via `@ai-sdk/anthropic`. If not set, falls back to `MockLanguageModel`, which returns static component code (Counter/Form/Card) — useful for development without an API key.

### Authentication (`src/lib/auth.ts`)

Custom JWT auth using `jose`. Sessions stored in `httpOnly` cookies (`auth-token`). The middleware (`src/middleware.ts`) validates session for protected routes. Users can also work anonymously; anonymous work is tracked in `sessionStorage` via `src/lib/anon-work-tracker.ts`.

### Preview System (`src/lib/transform/jsx-transformer.ts`)

- `transformJSX`: compiles JSX/TSX using Babel Standalone, strips CSS imports
- `createImportMap`: creates a browser import map with blob URLs for all VFS files; resolves third-party packages via `https://esm.sh/...`; creates placeholder modules for missing local imports
- `createPreviewHTML`: generates the full iframe HTML with Tailwind CDN, the import map, and a React error boundary

### Database (Prisma + SQLite)

The schema is defined in [prisma/schema.prisma](prisma/schema.prisma) — reference it whenever you need to understand the data structure. Models: `User` (email/password) → `Project` (name, messages JSON, data JSON). The `data` field stores the serialized VFS. Prisma client is generated to `src/generated/prisma`.

### Testing

Tests use Vitest + jsdom + React Testing Library. Test files live under `__tests__/` directories next to the modules they test.
