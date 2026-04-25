 # beads-kanban

Kanban board UI for the Beads issue tracker. Reads directly from `.beads` SQLite for fast queries and uses the `bd` CLI for writes. Optional embedded Claude Agent SDK server powers autonomous agent panes.

## Requirements
- **Runtime**: Node 18+ or Bun 1.0+
- **Beads CLI**: `bd` v0.49.0+ ([install](https://github.com/steveyegge/beads))
- **Optional**: `uv` + `beads-mcp` for agent MCP tools

## Installation

### From npm/git
```bash
npm install github:doublej/beads-kanban
# or
bun install github:doublej/beads-kanban
```

### From source
```bash
git clone https://github.com/doublej/beads-kanban
cd beads-kanban
bun install  # or npm install
```

### Usage
```bash
npx beads-kanban /path/to/project
# or with Bun
bunx beads-kanban /path/to/project
```

The CLI handles `bd` version checks, `.beads/` init, `bd doctor --fix`, and starting the dev server.

## Notifications (optional)
Two notification modes are available:

- **Browser push**: Web Push notifications via the service worker. VAPID keys are auto-generated on first use and stored in `.beads/beads-app.db`. Enable in the Notification Settings panel.
- **MCP (Consult User)**: Desktop notifications through the Consult User MCP server when available.

No setup is required — both modes work out of the box.

## Agent server (optional)

### Setup
1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. Create `.env` file:
   ```bash
   cp .env.example .env
   # Edit .env and set ANTHROPIC_API_KEY=sk-ant-api03-...
   ```
3. Run: `bun run dev:agent` (WebSocket on port 9347)

Agent dependencies are included in the root install. The `.env` file takes precedence over user-level `~/.claude/` auth, ensuring project-specific API usage.

## Configuration
- `.beads-cwd`: absolute path to the active Beads project (local-only; keep it untracked)
- `BEADS_KANBAN_CWD_FILE`: override the location of the `.beads-cwd` file
- `BEADS_MCP_PATH`: override beads MCP path for the agent server
- `AGENT_PORT`: agent server port (default 9347)
- `BD_DB`: optional override for Beads DB path (used as fallback)
- `VAPID_SUBJECT`: optional mailto: address for push notification VAPID keys (default: `mailto:admin@beadskanban.local`)
- `BEADS_KANBAN_AUTO_REAP=1`: on Ctrl-C, also `SIGTERM` orphan `dolt sql-server` processes spawned by this session's `bd sql` reads. Off by default — killing a dolt server held by another terminal's `bd` session would disrupt that session.

## Reaping orphan dolt servers

Each `bd sql` invocation spawns a per-project `dolt sql-server` that survives the parent. After a day of switching between projects, these can accumulate and exhaust memory.

Beads-kanban tracks the cwds it touches at `~/.cache/beads-kanban/touched-cwds-<pid>.json` and offers a `reap` subcommand to clean up:

```bash
beads-kanban reap                      # default --touched: reap orphans from dead sessions
beads-kanban reap --all                # reap any orphan dolt sql-server with /.beads/dolt in cwd
beads-kanban reap --scan-cwd <dir>     # reap only servers whose cwd is inside <dir>
```

The reaper only kills processes where all of: command contains `dolt sql-server`, ppid is launchd (`1`), and cwd is inside an explicitly-supplied directory. SIGTERM only — failures are reported, not escalated.

## Docs site
`cd docs && bun install && bun run dev`

## Architecture at a glance
- Reads: `src/lib/db.ts` reads SQLite in `.beads`
- Writes: API routes call the `bd` CLI (`src/lib/bd.ts`)
- Agent: `src/lib/server/agent` runs Claude Agent SDK and custom beads MCP wrappers
