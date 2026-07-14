# `strand://` URL scheme (macOS)

Clickable links that open the Kanban board on a specific issue:

```
strand://<issue-id>      e.g. strand://beads-kanban-41k
```

## How it works

1. `scheme/install.sh` builds a small AppleScript `.app` in `~/Applications` that
   registers the `strand` URL scheme with LaunchServices.
2. Its `on open location` handler forwards the clicked URL to `strand open <url>`.
3. `strand open` (see `bin/strand.ts`):
   - **reuses** a running board if one is up — just opens
     `https://localhost:<port>/?issue=<id>` on the existing dev server;
   - otherwise **starts** a board against the last-targeted project
     (`bin/.beads-cwd`) and opens the deep link once it's ready.

The board resolves `?issue=<id>` client-side; unknown ids show a toast.

## Install

```bash
scheme/install.sh
open 'strand://<some-issue-id>'   # test
```

First launch may show a Gatekeeper prompt — approve it once.

## Uninstall

```bash
scheme/install.sh --uninstall
```

## Clickable links in the terminal (Ghostty / iTerm2)

Terminals only auto-detect `http(s)`/`file` URLs, not custom schemes. The
portable, zero-config way to make `strand://` links clickable is **OSC 8
hyperlinks** — both Ghostty and iTerm2 open them on ⌘-click via the registered
scheme handler.

Emit one from any script:

```bash
# strand-link <id> [label]
strand-link() { printf '\e]8;;strand://%s\e\\%s\e]8;;\e\\\n' "$1" "${2:-$1}"; }
strand-link beads-kanban-877y
```

Per-terminal notes:

- **Ghostty** — OSC 8 works out of the box (⌘-click). Bare `strand://…` *text*
  can't be auto-linked: the custom-regex `link` config is documented
  "can't currently be set". Use OSC 8.
- **iTerm2** — OSC 8 works (⌘-click). To also linkify bare `strand://…` text, add a
  Smart Selection rule: Settings → Profiles → Advanced → Smart Selection → Edit,
  regex `\bstrand://[A-Za-z0-9._-]+`, action **Open URL** `\0`.

## Notes

- Only the *most recently started* board is tracked for reuse
  (`~/.cache/strandkanban/active-server.json`). Ids from other projects will
  open on the active board and toast "not found" — that's expected.
- The handler logs to `/tmp/strand-scheme.log` for debugging.
