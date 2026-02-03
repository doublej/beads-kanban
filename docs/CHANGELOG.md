# Changelog

All notable changes to beads-kanban are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and commits are listed in chronological order.

## Recent Changes

### Added
- Horizontal scroll in markdown preview (397f193)
- Hardened ticket transition animation (3b41c37)
- Conflict resolution settings and modal design fixes (d92fe8e)
- Saved views/recipes for custom column configurations (87d35f4)
- Worktree startup visibility with progress messages (606e1d2)
- Beads workflow demonstration (95674ae)
- Ticket briefing to worktree agents (18821a3)
- Session history population when resuming (2245c30)
- bd CLI wrapper and types API endpoint (90db0f7)
- Onboarding setup wizard (64e44ea)
- Markdown rendering in detail panel view mode (4edbbdd)
- Doublej-project-linking widget to docs (45d612c)
- PWA + browser push notifications system (79ba756)
- Consult User MCP notification integration (7664fa5)
- Notification settings UI (5f27f42)
- In-app toast notification system (3c4001b)
- Notification foundation & event system (4be0fc2)
- Beads v0.42 compatibility (dc5ec46)
- New/read status UI for chat messages (6c93e33)
- Support for Claude slash commands with autocomplete (74c2acb, 96b310c)
- Ticket delivery and notification templates (bec30c8, 209f522)
- Close endpoint and comments in issues API (dd6af51)
- Attachments in issue API response (8c0db4b)
- Estimated token count to prompts editor (5f86bf9)
- System messages display in agent chat (9840c96)
- Paste image as attachment in DetailPanel (29d4e95)
- Agent notifications for ticket updates (d7d319e)
- Dedicated prompts editor window (c0356e9, 0daf982, a755541)
- Tabbed prompts window (09210d8)
- LINT step to agent workflow (327e772)
- Actionable filter (d9469f6)
- IBM Plex Mono font (0e53493)
- Bidirectional ticket-chat navigation (01743a9)
- CTA button system with 5 variants (8459669)
- Markdown rendering dependencies (0a933df)
- Desktop notifications for blocking events (2462d08)
- Attachments functionality to issues (af58c22)
- Optimistic updates and project switcher (8973d8a)
- localStorage persistence for chat sessions (3d8e262)
- Impact scoring with badges for high-value items (1aa998e)
- Status and label filters with negation support (1c8bb54)
- Kanban store foundation for state extraction (4f6d9bc)
- Create and start agent feature (cda347c)
- Session search and pane session picker (144b635)
- Comprehensive keyboard navigation system (a8f7d58)
- Flying card animations and dependency removal (decf1f2)

### Fixed
- Installation command in CLI (brew install bd)
- Normalize button heights with consistent 2rem sizing (cc80510)
- Parent-child deps in actionable filter (74c2f82)
- Slash command autocomplete filter (8debac7)
- Input width in slash command wrapper (7bfe740)
- Stop click propagation on PromptsEditor/Window (144a437)
- Show full streaming content instead of truncating (a8ab52b)
- Link resumed agent sessions to tickets via name pattern (b87b8a9)
- Inject context to running agent on notification (c0f6565)
- Open settings when opening prompts (bc9bf47)
- Modernize DepTypePicker UI (f172074)
- Render PromptsWindow inside SettingsPane overlay (b3ac331)
- Prompts window slides from settings sidebar (475bada)
- Disable pointer-events on agent-windows container (0419de8)
- Replace {name} in system prompt (83b6d86)
- Sync light theme across all components (bd8c168, d0387c1, 46d7190, 602d674)
- Remove page titles from views (c579424)
- Move view title to breadcrumb (13b2116)
- Unify toolbar and top bar layout (30326a4, 69f251d)
- Delete now actually removes issues (a250fdc)
- Simplify card design, replace border bar with dot (7ef97a5)
- Prevent chat bar from overlapping UI (dbfc61a)
- Redesign drag-to-link button (c0ea340)
- Remove orange border, unify chat window design (d421a0a)
- Simplify project switcher design (36a71a4)
- Improve mobile styles for compactness (93e307f)
- Soften project switch wipe with gradient mask (d586b95)
- Move status into specs-bar, add summary callout (f116878)
- Restore rotating sun icons in agent panes and cards (ec7924a, 9cc04e3)
- Default column sort to newest first (280112a)
- Raise detail panel z-index above agent windows (142bc72)
- Refine agent menu styling (bedae71)
- Autoscroll only active pane with toggle (3d0c44c)
- Raise settings pane z-index to 10000 (c6f0a2d)
- Visual feedback, issue search component, and animation fixes (4ce79ce)

### Refactored
- Move theme control to body element (cfe5c97)
- Extract helper functions to reduce duplication (d9b0360)
- Slim zshrc to one-liner, add free-port and bd doctor to CLI entry (caa661f)
- Auto-generate VAPID keys, add test notification endpoint (96895ce)
- Extract page-ops module, simplify settings sync (d4afd2c)
- Extract card-drag, filters, color scheme CSS from +page.svelte (5d7371e)
- Extract logic modules, agent bar, global CSS from +page.svelte (a4dc223)
- Split DetailPanel, PaneActivity, SettingsPane, and smaller components (c17a463)
- Split Header into 5 sub-components (09d89ce)
- Split IssueCard and KanbanColumn into sub-components (a12f25d)
- Split wsStore into 5 focused modules (8b60729)
- Extract http client and animation helpers (5af23a3)
- Deduplicate attachment utils (ca2eb16)
- Extract session-persistence.ts from wsStore (c86d7f4)
- Simplify kanban store API (740135f)
- Split agent/index.ts into focused modules (4e505c3)
- Switch to bun, update docs (0a933df)
- Consolidate header into single toolbar with chat toggle (7bd3317)
- Remove duplicate CSS from +page.svelte (b351d0d)
- Extract multiple components from +page.svelte (various commits)
- Update card styling and priority labels (f27e23e)

### Documentation
- Document notification system in CLAUDE.md and docs site (4f3e663)
- Remove outdated context and fix line count claims (a20986e)
- Fix outdated documentation (295afcb)
- Add GitHub Pages docs site (d78ba03)

### Styling
- Warm paper-like light theme with slate tones (46d7190, 81f28a4)
- Unify design language with reduced color palette (dc33f5b)
- Design system cleanup and visual overhaul (7b3038d)
- Apply CTA system to picker-close button (7b27fd7)
- Clean up specs-bar with rhythm (ccf1177)
- Simplify card design (7ef97a5)
- Redesign ticket-chat navigation links (2f7e0d4)
- Smaller font-size and no soft-wrap in prompts editor (00c7b01)
- Replace unicode icons with SVGs in agent panes (8ab9b0b)
- Redesign session picker and start/restart buttons (78c63e9)
- Redesign detail pane layout (4d73075)

### Chore
- Update beads metadata (c93c360)
- Update beads issues database (978b97b)
- Sync beads issues (2323e71)

## Project History

The project began in December 2025 with basic Kanban functionality and has evolved to include:
- Comprehensive agent integration via Claude Agent SDK
- Real-time WebSocket communication
- Push notifications (browser and MCP)
- Advanced keyboard navigation
- Markdown rendering and syntax highlighting
- Attachment management
- Multiple theme support
- Extensive UI refinements and component extraction

---

*Generated from git history on 2026-02-03*
