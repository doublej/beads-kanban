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
- Agent dependencies are included in the root install
- Run UI + agent server: `bun run dev:agent` (WebSocket on port 9347)
- Set Anthropic credentials for the SDK (see Anthropic docs)

## Configuration
- `.beads-cwd`: absolute path to the active Beads project (local-only; keep it untracked)
- `BEADS_KANBAN_CWD_FILE`: override the location of the `.beads-cwd` file
- `BEADS_MCP_PATH`: override beads MCP path for the agent server
- `AGENT_PORT`: agent server port (default 9347)
- `BD_DB`: optional override for Beads DB path (used as fallback)
- `VAPID_SUBJECT`: optional mailto: address for push notification VAPID keys (default: `mailto:admin@beadskanban.local`)

## Docs site
`cd docs && bun install && bun run dev`

## Architecture at a glance
- Reads: `src/lib/db.ts` reads SQLite in `.beads`
- Writes: API routes call the `bd` CLI (`src/lib/bd.ts`)
- Agent: `src/lib/server/agent` runs Claude Agent SDK and custom beads MCP wrappers
