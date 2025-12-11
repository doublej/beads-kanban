# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Beads-Kanban is a SvelteKit web app that provides a Kanban board UI for the [Beads](https://github.com/steveyegge/beads) issue tracker. It wraps the `bd` CLI to provide drag-and-drop issue management.

## Commands

```bash
npm run dev      # Start dev server (HMR disabled in vite.config.ts)
npm run build    # Build for production
npm run check    # Type-check with svelte-check
```

## Architecture

### Data Flow
- **Backend**: API routes in `src/routes/api/` shell out to `bd` CLI commands
- **Frontend**: Single-page Kanban in `src/routes/+page.svelte` (large file, ~2000+ lines)
- Issues flow: `bd list --json` → API → Svelte state → Kanban columns

### Key Files
- `src/routes/+page.svelte` - Main Kanban board (all UI logic, drag/drop, keyboard nav)
- `src/routes/api/issues/+server.ts` - GET/POST issues via `bd` CLI
- `src/routes/api/issues/[id]/+server.ts` - PATCH/DELETE single issue
- `src/lib/wsStore.svelte.ts` - WebSocket store for pane bridge (ws://localhost:8765)
- `src/lib/types.ts` - TypeScript interfaces (Issue, Dependency, Column, etc.)
- `src/lib/api.ts` - Client-side API calls
- `src/lib/utils.ts` - Kanban helpers (columns config, sorting, filtering)

### Issue Status Flow
`open` → `in_progress` → `blocked` → `closed`

Each status maps to a Kanban column (Backlog, In Progress, Blocked, Complete).

### Beads CLI Integration
All issue operations shell out to `bd` commands:
- `bd list --json` - Fetch all issues
- `bd create "title"` - Create issue
- `bd update ID --status STATUS` - Update issue
- `bd close ID` - Close issue

The `.beads/` directory contains the issue database (JSONL format).

## Tech Stack
- Svelte 5 (uses `$state`, `$derived`, `$effect` runes)
- SvelteKit 2
- TypeScript
- Vite 5
