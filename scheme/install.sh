#!/usr/bin/env bash
#
# Registers the `bdk://<id>` URL scheme on macOS.
#
# Builds a tiny AppleScript .app whose `on open location` handler forwards the
# clicked URL to the bdk CLI (`bdk open bdk://<id>`), which focuses the board on
# that issue — reusing a running board if one is up, else starting one.
#
# Usage:  scheme/install.sh            # install / re-install
#         scheme/install.sh --uninstall
#
set -euo pipefail

APP_NAME="Beads Kanban URL"
APP_PATH="$HOME/Applications/${APP_NAME}.app"
BUNDLE_ID="com.doublej.beads-kanban.url"

# Repo root = parent of this script's dir.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_ENTRY="$REPO_DIR/bin/bdk.ts"

uninstall() {
	if [[ -d "$APP_PATH" ]]; then
		rm -rf "$APP_PATH"
		echo "Removed $APP_PATH"
	fi
	/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
		-kill -r -domain local -domain user >/dev/null 2>&1 || true
	echo "Unregistered bdk:// scheme."
	exit 0
}

[[ "${1:-}" == "--uninstall" ]] && uninstall

# Resolve an absolute bun path — `do shell script` runs with a minimal PATH.
BUN_BIN="$(command -v bun || true)"
if [[ -z "$BUN_BIN" ]]; then
	echo "Error: bun not found on PATH. Install bun, then re-run." >&2
	exit 1
fi
if [[ ! -f "$CLI_ENTRY" ]]; then
	echo "Error: CLI entry not found: $CLI_ENTRY" >&2
	exit 1
fi

echo "Handler:  $BUN_BIN $CLI_ENTRY open <url>"
echo "App:      $APP_PATH"

# `do shell script` runs with a minimal PATH; the spawn path needs bd/bunx/node.
# Resolve the real dirs of bun and bd (bd is often in ~/.local/bin) so they're found.
BUN_DIR="$(dirname "$BUN_BIN")"
BD_BIN="$(command -v bd || true)"
BD_DIR="${BD_BIN:+$(dirname "$BD_BIN")}"
PATH_PREFIX="$BUN_DIR${BD_DIR:+:$BD_DIR}:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# 1. Compile the AppleScript handler into an .app bundle.
SCPT="$(mktemp -t bdk-scheme).applescript"
cat >"$SCPT" <<APPLESCRIPT
on open location theURL
	set theCmd to "export PATH=" & quoted form of "$PATH_PREFIX" & "; " & quoted form of "$BUN_BIN" & " " & quoted form of "$CLI_ENTRY" & " open " & quoted form of theURL & " </dev/null >/tmp/bdk-scheme.log 2>&1 &"
	do shell script theCmd
end open location
APPLESCRIPT

rm -rf "$APP_PATH"
mkdir -p "$(dirname "$APP_PATH")"
osacompile -o "$APP_PATH" "$SCPT"
rm -f "$SCPT"

# 2. Register the bdk:// scheme in the app's Info.plist.
PLIST="$APP_PATH/Contents/Info.plist"
PB=/usr/libexec/PlistBuddy
"$PB" -c "Add :CFBundleIdentifier string $BUNDLE_ID" "$PLIST" 2>/dev/null \
	|| "$PB" -c "Set :CFBundleIdentifier $BUNDLE_ID" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes array" "$PLIST" 2>/dev/null || true
"$PB" -c "Add :CFBundleURLTypes:0 dict" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLName string Beads Kanban" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string bdk" "$PLIST"

# 3. Tell LaunchServices about it.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
	-f "$APP_PATH"

echo
echo "Registered. Test with:"
echo "  open 'bdk://<some-issue-id>'"
echo
echo "First launch may show a Gatekeeper prompt — approve it once."
echo "Uninstall: scheme/install.sh --uninstall"
