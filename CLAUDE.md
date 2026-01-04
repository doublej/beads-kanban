# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Beads-Kanban is a SvelteKit web app that provides a Kanban board UI for the [Beads](https://github.com/steveyegge/beads) issue tracker. It wraps the `bd` CLI to provide drag-and-drop issue management.

## Commands

```bash
bun run dev      # Start dev server (HMR disabled in vite.config.ts)
bun run build    # Build for production
bun run check    # Type-check with svelte-check
```

## Architecture

### Data Flow
- **Backend**: API routes in `src/routes/api/` use `$lib/db.ts` for reads, shell out to `bd` CLI for writes
- **Frontend**: Single-page Kanban in `src/routes/+page.svelte` (large file, ~3600+ lines)
- Issues flow: SQLite DB → `$lib/db.ts` → API → Svelte state → Kanban columns

### Key Files
- `src/routes/+page.svelte` - Main Kanban board (all UI logic, drag/drop, keyboard nav)
- `src/routes/api/issues/+server.ts` - GET (via db)/POST (via bd CLI) issues
- `src/routes/api/issues/[id]/+server.ts` - PATCH/DELETE single issue via `bd` CLI
- `src/lib/db.ts` - SQLite database access for reading issues (bypasses CLI for perf)
- `src/lib/wsStore.svelte.ts` - WebSocket store for embedded agent server (ws://localhost:9347)
- `src/lib/types.ts` - TypeScript interfaces (Issue, Dependency, Column, etc.)
- `src/lib/api.ts` - Client-side API calls
- `src/lib/utils.ts` - Kanban helpers (columns config, sorting, filtering)

### Issue Status Flow
`open` → `in_progress` → `hooked` → `blocked` → `closed`

Each status maps to a Kanban column (Backlog, In Progress, Hooked, Blocked, Complete).

### Beads CLI Integration
Write operations shell out to `bd` commands:
- `bd create "title" --json` - Create issue
- `bd update ID --status STATUS` - Update issue
- `bd close ID --reason "..."` - Close/delete issue

The `.beads/` directory contains the issue database (SQLite + JSONL).

## Tech Stack
- Svelte 5 (uses `$state`, `$derived`, `$effect` runes)
- SvelteKit 2
- TypeScript
- Vite 5
