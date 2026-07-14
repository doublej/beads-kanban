# strandkanban

strandkanban is a drag and drop Kanban board for [Beads](https://github.com/gastownhall/beads) issues. One command starts it, and your issues never leave your repo.

```bash
npx github:doublej/strandkanban /path/to/project
```

Beads stores issues in your repository and manages them through the `bd` CLI. The CLI works well for agents and scripts, but a long issue list in a terminal is hard to scan. strandkanban reads the same database and puts the issues on a live board. Every edit on the board goes through `bd`, so the CLI, your agents, and the board always work from the same data.

The name is literal. A strand is a string of beads.

## Quick start

```bash
# 1. Install Beads once
brew install beads
# or: curl -fsSL https://raw.githubusercontent.com/gastownhall/beads/main/scripts/install.sh | bash

# 2. Start a board for a project
npx github:doublej/strandkanban /path/to/project
```

Install globally to get the short `bdk` command:

```bash
npm install -g github:doublej/strandkanban
bdk /path/to/project
```

The launcher handles setup for you:

- checks that `bd` is version 1.0.0 or newer
- offers to run `bd init` when the target has no `.beads/`, then runs `bd doctor --fix --yes`
- picks a free local port
- starts the optional agent WebSocket server
- opens deep links when requested

## What you get

- **Drag and drop.** Move a card between columns to change its status. Reorder cards inside a column to set priority.
- **Keyboard navigation.** Drive the whole board with arrow keys or vim-style hjkl.
- **Live updates.** The board updates when the CLI or an agent changes an issue. You do not need to refresh.
- **Agent panes.** Run embedded agent sessions next to the board. The panes need an `ANTHROPIC_API_KEY`.
- **Inline editing.** Edit titles, descriptions, and comments on the board without leaving the view.
- **Dependency tracking.** Link issues with parent, child, and blocker relationships, and see what blocks what in the dependency graph.
- **More views.** Switch between the board, a table, the dependency graph, and a grid overview. Open zen mode for a focused review of selected issues.
- **Search and filters.** Filter by text, priority, type, label, time, and whether an issue is actionable.
- **Notifications.** Get browser push and desktop notifications when issues change.
- **Deep links.** Open `bdk://issue-id` links to jump straight to an issue on a running board.

The board has five columns: Backlog, In Progress, Hooked, Blocked, and Complete. They map to the Beads statuses `open`, `in_progress`, `hooked`, `blocked`, and `closed`.

## Requirements

- Node 18+ or Bun 1.0+
- Beads CLI `bd` v1.0.0+
- macOS or Linux for the normal install flow
- Optional: `ANTHROPIC_API_KEY` for agent panes

Verify the basics:

```bash
bd --version
node --version
bdk --version
```

## Daily usage

```bash
bdk                         # start against the current directory
bdk ~/code/my-project       # start against another project
bdk open bdk://proj-123     # focus an issue on the running board
bdk zen proj-123,proj-456   # open focus review for selected issues
bdk reap                    # clean stale dolt sql-server processes from old sessions
```

If the CLI finds no `.beads/` in the target project, it asks before initializing Beads.

## Install from source

```bash
git clone https://github.com/doublej/strandkanban
cd strandkanban
bun install
bun run build:cli
./bin/bdk /path/to/project
```

If you prefer npm:

```bash
npm install
npm run build:cli
./bin/bdk /path/to/project
```

## Optional setup

### Agent panes

Create `.env` in this repo when you want embedded agent sessions:

```bash
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=...
```

Then launch with `bdk /path/to/project`. The CLI starts the agent server on port `9347` when the port is available.

### Notifications

- Browser push notifications use the service worker. VAPID keys are generated on first use and stored in `.beads/beads-app.db`.
- Desktop notifications go through the Consult User MCP server when it is available.

### `bdk://` links on macOS

```bash
scheme/install.sh
open 'bdk://some-issue-id'
```

The script registers a small URL handler that forwards links to `bdk open`. See [scheme/README.md](scheme/README.md) for uninstall and terminal hyperlink notes.

## Configuration

- `.beads-cwd`: local file containing the active Beads project path
- `BEADS_KANBAN_CWD_FILE`: override the `.beads-cwd` location
- `BEADS_MCP_PATH`: override the Beads MCP path for the agent server
- `AGENT_PORT`: agent server port, default `9347`
- `BD_DB`: optional fallback override for Beads DB path
- `VAPID_SUBJECT`: VAPID subject for push notifications
- `BEADS_KANBAN_AUTO_REAP=0`: disable session-scoped dolt server cleanup
- `BEADS_KANBAN_BD_TIMEOUT_MS`: override Beads push/pull timeout

## Troubleshooting

### `bd` not found

Install Beads, then restart your shell:

```bash
brew install beads
# or
curl -fsSL https://raw.githubusercontent.com/gastownhall/beads/main/scripts/install.sh | bash
```

### Native module install fails

`better-sqlite3` may need local build tools.

```bash
xcode-select --install          # macOS
sudo apt install build-essential # Debian/Ubuntu
```

### The server opens on a different port

`bdk` starts at port `5185` and moves upward until it finds a free port. A busy machine lands on a higher port.

### Stale dolt servers use memory

```bash
bdk reap
bdk reap --scan-cwd ~/code/my-project
```

Use `bdk reap --all` only when you want to clean every orphan `dolt sql-server` whose cwd contains `/.beads/dolt`.

## Development

```bash
bun run dev        # start the dev server
bun run check      # type-check with svelte-check
bun run build      # build for production
bun run build:cli  # compile the bdk launcher
```

Architecture:

- UI: [src/routes/+page.svelte](src/routes/+page.svelte)
- Reads: [src/lib/db.ts](src/lib/db.ts) via `bd sql --json`
- Writes: API routes under [src/routes/api](src/routes/api) shell out to `bd`
- Agent server: [src/lib/server/agent](src/lib/server/agent)
