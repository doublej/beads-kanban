# beads-kanban

Local Kanban UI for [Beads](https://github.com/gastownhall/beads) issue tracking. It starts a SvelteKit board for any project with `.beads/`, reads through `bd sql --json`, and writes through the `bd` CLI so Beads stays the source of truth.

## Quick Start

```bash
# 1. Install Beads once
brew install beads
# or: curl -fsSL https://raw.githubusercontent.com/gastownhall/beads/main/scripts/install.sh | bash

# 2. Start a board for a project
npx github:doublej/beads-kanban /path/to/project
```

Use the short command after a global install:

```bash
npm install -g github:doublej/beads-kanban
bdk /path/to/project
```

The launcher validates `bd >= 1.0.0`, offers to run `bd init` when the target has no `.beads/`, runs `bd doctor --fix --yes` after init, chooses a free local Vite port, starts the optional agent WebSocket server, and opens deep links when requested.

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

## Install From Source

```bash
git clone https://github.com/doublej/beads-kanban
cd beads-kanban
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

## Daily Usage

```bash
bdk                         # start against the current directory
bdk ~/code/my-project       # start against another project
bdk open bdk://proj-123     # focus an issue on the running board
bdk zen proj-123,proj-456   # open focus review for selected issues
bdk reap                    # clean stale dolt sql-server processes from old sessions
```

If the CLI finds no `.beads/` in the target project, it asks before initializing Beads. All issue edits still go through `bd`, so CLI, agents, and the board share the same data.

## Optional Setup

### Agent Panes

Create `.env` in this repo when you want embedded agent sessions:

```bash
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=...
```

Then launch with `bdk /path/to/project`. The CLI starts the agent server on port `9347` when it is available.

### Notifications

- Browser push notifications use the service worker. VAPID keys are generated on first use and stored in `.beads/beads-app.db`.
- Consult User MCP desktop notifications are used automatically when the MCP server is available.

### `bdk://` Links On macOS

```bash
scheme/install.sh
open 'bdk://some-issue-id'
```

This registers a tiny URL handler that forwards links to `bdk open`. See [scheme/README.md](scheme/README.md) for uninstall and terminal hyperlink notes.

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

### `bd` Not Found

Install Beads, then restart your shell:

```bash
brew install beads
# or
curl -fsSL https://raw.githubusercontent.com/gastownhall/beads/main/scripts/install.sh | bash
```

### Native Module Install Fails

`better-sqlite3` may need local build tools.

```bash
xcode-select --install          # macOS
sudo apt install build-essential # Debian/Ubuntu
```

### Local Server Opens On A Different Port

That is expected. `bdk` starts at port `5185` and moves upward until it finds a free port.

### Stale Dolt Servers Use Memory

```bash
bdk reap
bdk reap --scan-cwd ~/code/my-project
```

Use `bdk reap --all` only when you want to clean every orphan `dolt sql-server` whose cwd contains `/.beads/dolt`.

## Development

```bash
bun run dev
bun run check
bun run build
bun run build:cli
```

Architecture:

- UI: [src/routes/+page.svelte](src/routes/+page.svelte)
- Reads: [src/lib/db.ts](src/lib/db.ts) via `bd sql --json`
- Writes: API routes under [src/routes/api](src/routes/api) shell out to `bd`
- Agent server: [src/lib/server/agent](src/lib/server/agent)
