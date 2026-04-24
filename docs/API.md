# Beads-Kanban HTTP API

This is the API surface for driving the board from outside the browser — read tickets, post comments, run agents, subscribe to events.

The app is local-only. There is no auth, no API key, no CORS hardening. If the dev server is reachable from your shell, it accepts your requests.

- **Base URL** — defaults to `http://localhost:5173`. Use whatever host the SvelteKit dev/build server is running on.
- **Project context** — every endpoint that touches a project's data requires `?project=<absolute-path>`. The path must contain a `.beads` directory. Endpoints that don't take `?project=` are listed as "global" below.
- **Content type** — every JSON request must send `Content-Type: application/json`.

## Response envelope

Every JSON response uses one of two shapes:

```json
{ "ok": true, "data": <payload> }
```

```json
{ "ok": false, "error": { "message": "...", "code": "VALIDATION", "details": [...] } }
```

`code` is set for known failure modes (`VALIDATION`, `CWD_MISSING`, `NOT_FOUND`, `NOT_DIR`, `NO_BEADS`, `FILE_TOO_LARGE`). For zod validation failures, `details` holds the raw issue array from `zod`.

Binary endpoints (file downloads under `attachments/[filename]`) return raw bodies and bypass the envelope.

## Quick examples

```bash
PROJECT="/Users/me/code/myproj"

# List issues
curl "localhost:5173/api/issues?project=$PROJECT"

# Create issue
curl -X POST "localhost:5173/api/issues?project=$PROJECT" \
  -H 'content-type: application/json' \
  -d '{"title":"ext-test","priority":2,"issue_type":"task"}'

# Subscribe to events (SSE)
curl -N "localhost:5173/api/events/stream?project=$PROJECT"

# Enqueue an agent
curl -X POST "localhost:5173/api/agents?project=$PROJECT" \
  -H 'content-type: application/json' \
  -d '{"ticketId":"bd-1"}'
```

```ts
// TypeScript client
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`http://localhost:5173${path}`, init);
  const payload = await res.json();
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data as T;
}

const project = '/Users/me/code/myproj';
const { issues } = await api<{ issues: Issue[] }>(`/api/issues?project=${encodeURIComponent(project)}`);
```

---

## Issues

### `GET /api/issues?project=…`

Returns the full issue list for the project.

- **Response** — `{ issues: Issue[] }`

### `POST /api/issues?project=…`

Create a new issue.

- **Body** (zod-validated):
  ```ts
  {
    title: string;            // required, min 1 char
    description?: string;
    priority?: 0 | 1 | 2 | 3 | 4;
    issue_type?: string;       // e.g. "task", "bug", "feature"
    assignee?: string;
    labels?: string[];
    deps?: string[];           // ticket IDs this one blocks-on
    dependencies?: string[];   // alias for deps
  }
  ```
- **Response** — `{ id: string; issue: BdCreateOutput; warning?: string }`

### `PATCH /api/issues/:id?project=…`

Update fields on an existing issue.

- **Body** — any subset of:
  ```ts
  {
    status?: 'open' | 'in_progress' | 'hooked' | 'blocked' | 'closed';
    title?: string;
    description?: string;
    priority?: 0 | 1 | 2 | 3 | 4;
    design?: string;
    acceptance_criteria?: string;
    notes?: string;
    assignee?: string | null;
    addLabels?: string[];
    removeLabels?: string[];
    agent_model?: 'haiku' | 'sonnet' | 'opus' | '' | null;
    agent_effort?: 'low' | 'medium' | 'high' | '' | null;
  }
  ```
  Setting `agent_model`/`agent_effort` to `null` or empty string clears the metadata. Label add/remove run in parallel.
- **Response** — `{ updated: true }`

### `DELETE /api/issues/:id?project=…`

Permanently delete an issue (`bd delete`). For closing as completed, use the close endpoint below.

- **Response** — `{ deleted: true }`

### `POST /api/issues/:id/close?project=…`

Close an issue with a reason.

- **Body** — `{ reason?: string }` (defaults to `"Completed"`)
- **Response** — `{ closed: true }`

### `GET /api/issues/:id/children?project=…`

Tickets that depend on this one with `dependency_type === 'parent-child'`.

- **Response** — `{ children: { id, title, status }[] }`

### Comments

- `GET /api/issues/:id/comments?project=…` → `{ comments: Comment[] }`
- `POST /api/issues/:id/comments?project=…` body `{ text: string }` → `{ added: true }`

### Dependencies

- `POST /api/issues/:id/deps?project=…` body `{ depends_on: string; dep_type?: string }` (default `"blocks"`) → `{ added: true }`
- `DELETE /api/issues/:id/deps?project=…` body `{ depends_on: string }` → `{ removed: true }`

### Attachments

- `GET /api/issues/:id/attachments?project=…` → `{ attachments: Attachment[] }`
- `POST /api/issues/:id/attachments?project=…` — multipart, field `file`. Max 10 MB. Returns `{ attachment: Attachment }`.
- `GET /api/issues/:id/attachments/:filename?project=…` — **binary**, no envelope. Used for downloads.
- `DELETE /api/issues/:id/attachments/:filename?project=…` → `{ deleted: true }`

### Agent sessions for an issue

- `GET /api/issues/:id/agent-sessions?project=…` → `{ sessions: SdkSessionInfo[] }`. Filtered by `agentName` prefix `<id>-`.

---

## Events

### `GET /api/events/stream?project=…` *(SSE)*

Server-Sent Events stream. Subscribe once and receive every change to the project's data. Events arrive as `data:` frames containing JSON.

Frame shapes:

```jsonc
{ "type": "ready",     "cwd": "/path", "timestamp": 1714000000000 }
{ "type": "heartbeat", "timestamp": 1714000025000 }
{
  "type": "event",
  "name": "issue.created" | "issue.updated" | "issue.closed" | "issue.comment_added",
  "originalType": "status_changed",   // raw notification type
  "issueId": "bd-42",
  "issue": Issue,
  "timestamp": 1714000010000
}
```

Heartbeats fire every 25 seconds.

```ts
const es = new EventSource(`http://localhost:5173/api/events/stream?project=${encodeURIComponent(project)}`);
es.onmessage = (m) => {
  const f = JSON.parse(m.data);
  if (f.type === 'event' && f.name === 'issue.created') console.log('new issue', f.issue);
};
```

### `GET /api/events?project=…&since=<unix-ms>&limit=100`

Polling fallback for clients that can't hold SSE open. Returns the recent mutation log filtered to entries with `timestamp > since`.

- **Response** — `{ events: MutationEntry[] }`. `limit` capped at 500, default 100.

---

## Agent control

External agents (and the UI) use these to drive the embedded `claude-agent-sdk` worker.

### `POST /api/agents?project=…`

Enqueue work on a ticket. The agent server picks it up when capacity allows.

- **Body**:
  ```ts
  {
    ticketId: string;          // required
    agentName?: string;        // default: `${ticketId}-agent`
    model?: string;            // e.g. "claude-sonnet-4-6"
    useWorktree?: boolean;     // run in a git worktree
    title?: string;
    description?: string;
    priority?: 0 | 1 | 2 | 3 | 4;
    issueType?: string;
  }
  ```
- **Response** — `{ queued: true; ticketId; enqueuedAt }`

### `GET /api/agents?project=…`

Snapshot of what's running and what's waiting.

- **Response** — `{ active: ActiveSession[]; queued: QueueItem[] }`

### `GET /api/agents/:sessionId`

Status of a single session.

- **Response** — `{ sessionId, agentName, cwd, projectCwd, ticketId, worktreePath, isRunning, isManager, model, sdkSessionId, usage }`

### `DELETE /api/agents/:sessionId`

Interrupt the session (calls `abortController.abort()`). The session row stays in memory until cleanup.

- **Response** — `{ interrupted: true; sessionId }`

### `POST /api/agents/:sessionId/message`

Inject a user message into a running session. Equivalent to typing in the agent pane.

- **Body** — `{ text: string }`
- **Response** — `{ delivered: true }`

> Live status updates for these endpoints flow through `/api/events/stream` — there's no per-session SSE, just the single project-scoped feed.

---

## Misc

### `GET /api/cwd` *(global)*

Returns the server's stored cwd — the default project used when no `?project=` is supplied to the few legacy endpoints that still allow it.

- **Response** — `{ cwd, name }`

### `POST /api/cwd` *(global)*

Switch the stored cwd. Validates that `path` exists, is a directory, and contains `.beads`.

- **Body** — `{ path: string }`
- **Response** — `{ cwd, name }`

### `GET /api/projects` *(global)*

List of recently opened projects (stored in `~/.beads-kanban-projects.json`).

- **Response** — `{ projects: { path, name, lastAccess, color }[] }`

### `POST /api/projects` *(global)*

Touch or upsert a project entry.

- **Body** — `{ path: string; name?: string; color?: string }`
- **Response** — `{ projects: Project[] }`

### `GET /api/diff?project=…&rev=HEAD~1`

Diff the current issue list against the issues at a git revision (reads `.beads/issues.jsonl`).

- **Response** — `DiffResult` (see `src/lib/types.ts`)

### `GET /api/hooks?project=…`

Returns the project's loaded agent hooks.

- **Response** — `{ cwd, hooks }`

### `GET /api/worktrees?project=…`

Returns the active git worktrees registered for the project.

- **Response** — `{ cwd, worktrees }`

### Agent process management *(global)*

- `POST /api/agent` body `{ action: 'start' | 'stop' | 'restart' }` — controls the agent worker process spawned on `:9347`.
- `GET /api/agent/health` — `{ healthy: boolean }`
- `POST /api/agent/name` — generates a fun two-word name via Haiku. Returns `{ name }`.

### Notifications *(global)*

- `GET /api/notifications/vapid` — `{ publicKey }` for web-push subscription.
- `POST /api/notifications/subscribe` body `{ endpoint, keys: { p256dh, auth } }` → `{ subscribed: true }`
- `POST /api/notifications/send` body `{ title, body, data? }` → `{ sent, failed }`
- `POST /api/notifications/test` → `{ sent, failed }` (sends a test push)

---

## End-to-end smoke test

A short Node script that exercises the surface — useful as a sanity check after pulling.

```ts
const BASE = 'http://localhost:5173';
const PROJECT = process.env.PROJECT!;
const q = `?project=${encodeURIComponent(PROJECT)}`;

async function call(path: string, init?: RequestInit) {
  const res = await fetch(BASE + path, init);
  const p = await res.json();
  if (!p.ok) throw new Error(`${path}: ${p.error.message}`);
  return p.data;
}

// 1. List
const { issues } = await call(`/api/issues${q}`);
console.log('issues:', issues.length);

// 2. Create
const { id } = await call(`/api/issues${q}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: 'smoke test', priority: 3 }),
});

// 3. Comment
await call(`/api/issues/${id}/comments${q}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text: 'hello from script' }),
});

// 4. Subscribe to events
const es = new EventSource(`${BASE}/api/events/stream${q}`);
es.onmessage = (m) => console.log('event:', m.data);

// 5. Enqueue an agent
await call(`/api/agents${q}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ticketId: id }),
});
```
