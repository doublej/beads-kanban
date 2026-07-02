# `bdk://` URL scheme (macOS)

Clickable links that open the Kanban board on a specific issue:

```
bdk://<issue-id>      e.g. bdk://beads-kanban-41k
```

## How it works

1. `scheme/install.sh` builds a small AppleScript `.app` in `~/Applications` that
   registers the `bdk` URL scheme with LaunchServices.
2. Its `on open location` handler forwards the clicked URL to `bdk open <url>`.
3. `bdk open` (see `bin/bdk.ts`):
   - **reuses** a running board if one is up — just opens
     `https://localhost:<port>/?issue=<id>` on the existing dev server;
   - otherwise **starts** a board against the last-targeted project
     (`bin/.beads-cwd`) and opens the deep link once it's ready.

The board resolves `?issue=<id>` client-side; unknown ids show a toast.

## Install

```bash
scheme/install.sh
open 'bdk://<some-issue-id>'   # test
```

First launch may show a Gatekeeper prompt — approve it once.

## Uninstall

```bash
scheme/install.sh --uninstall
```

## Notes

- Only the *most recently started* board is tracked for reuse
  (`~/.cache/beads-kanban/active-server.json`). Ids from other projects will
  open on the active board and toast "not found" — that's expected.
- The handler logs to `/tmp/bdk-scheme.log` for debugging.
