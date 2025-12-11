# Accumulated Briefing

**Progress:** 1/1 chunks processed

---

# Strand Kanban - Project Briefing

## Project Identity & Purpose

**Name**: Strand Kanban (formerly beads-kanban)

**Purpose**: A sophisticated Kanban board interface that directly integrates with the Beads issue tracking CLI tool. This project extends Beads with:
- Real-time WebSocket-based UI
- Agent orchestration capabilities
- Advanced drag-and-drop workflow management

**Key Differentiators from VibeKanban**: [Document this in informational pages]

## Tech Stack & Architecture

### Core Technologies
- **Framework**: SvelteKit 5 with Svelte 5 (runes: `$state`, `$effect` - NOT stores)
- **Backend**: SvelteKit API routes interfacing with `bd` CLI
- **Real-time**: WebSocket for live updates and agent communication
- **Development**: Vite (HMR disabled per user preference)

### Working Directory
`/Users/jurrejan/Documents/development/_management/beads-kanban`

### Beads CLI Integration

**Issue Management Commands**:
- List issues: `bd list --json`
- Update status: `bd update <id> --status <status>`
- Close issue: `bd close <id> --reason "..."`
- View comments: `bd comments <issue-id>`
- Add comment: `bd comments add <issue-id> "text"`
- Prime workflow context: `bd prime`

**Issue Statuses**: 
- Core: `open`, `in_progress`, `blocked`, `closed`
- Virtual columns (label-based): `draft`, `feedback`, `review` (map to `open` status with labels)

**Issue Types**: `task`, `bug`, `feature`, `epic`, `chore`

**Priority Levels**: 1-4 (P1-P4)

**Issue Data Fields**:
- Core: id, title, description, status, priority, issue_type, assignee, labels
- Temporal: created_at, updated_at, closed_at
- Dependencies: dependency_count, dependent_count, actual dependency titles
- Extended: design, acceptance, notes, comments
- External: external_ref

### API Endpoints

1. **GET /api/issues** - Returns `{issues: [...]}`
2. **POST /api/issues** - Create new issue
3. **PATCH /api/issues/[id]** - Update issue (status, title, description, priority, etc.)
4. **DELETE /api/issues/[id]** - Close issue
5. **Server-Sent Events (SSE)** - Live updates stream

### WebSocket Architecture

**Agent WebSocket** (Port 9347):
- Location: Sibling folder `kanban-clead` (kanban_claude)
- Uses Claude Agent SDK
- Commands: panes, status, add, send, get, rm
- Response format: `{type: "response", data: {...}}`
- Events: init, pane_added, message, delta, status

**Connection**: `ws://localhost:9347`

**Chat Pane Features**:
- Show message history (daemon broadcasts all messages)
- Collapsible, pinned to bottom of screen
- Resizable and movable windows
- Proper session history (no restart per message)

### External Hosting
- Allow external connections (use `--host` flag in Vite)
- Configure `server.allowedHosts` in vite.config.js for hosts like "m2.local"

### Global Command Setup
OS-wide command to run on any folder:
```bash
# Shell alias/function approach (no code changes to repo)
beads-kanban [folder]
```

## Design Philosophy & Preferences

### Inspiration
**"THINK! WHAT WOULD APPLE DO?!"** - Aim for sophisticated, polished, state-of-the-art design

### Visual Design Principles

**Color & Theming**:
- Day/night mode toggle (respect system preference)
- Meta tags for Safari theme-color (separate for light/dark modes)
- Background: Dynamic soft colorful tones (aurora-style gradients)
  - Focus colors around middle and top
  - Outside becomes lighter
  - Light mode background: Keep lightening until optimal (don't affect bead contrast)
  - Dark mode: Much lighter than default dark (multiple iterations requested)
  - Reduce banding in gradients
- Top bar: NO white background, NO border underneath

**Typography**:
- Logo: Bold, playful, non-serif font (NO contrasting weight/colors, NO orange diamond)
- Logo color: White or faint tint with hard 0.5px shadow (not soft)
- All text in top bar must align at baseline regardless of container size
- Priority labels: Tiny monospace font, written out full word (no abbreviation), colored same as border, positioned along colored line with margin, scaled down appropriately

**Spatial Design**:
- Fill the screen with columns
- If there's room, show more information per item
- Swimming lanes: Clean up top side, especially when lanes collapsed

**Form Elements**:
- Top bar controls: Add shading with 0.5px borders and shadows
- Make fresh, not too grey, not too much contrast
- Larger, more usable sizes
- Page links: Better alignment, lighter color (not too dark)

**Borders & Depth**:
- Beads: Subtle depth with 0.5px transparent shading (top white, bottom black)
- Should be slightly more apparent than initial attempt
- Subtle, quite distanced shadow behind each bead (not extreme, not clipped by containers)
- Left border must be clipped by border-radius correctly
- Border-radius: Properly applied (2005-style gradients rejected)

### Card (Bead) Design

**Layout & Elements**:
- Type icon: Align with bead ID (not too far in corner), add label back in bottom right corner
- Priority: Vertical colored line on left edge + label on hover only
- Agent chip: Move to top right, show only in "in progress" column (NOT in "complete" or when hidden from blocked)
- Agent chip style: Keep the beautiful design (explicit rejection of removal)
- Dependencies: Show actual issue titles, not just counts
- Description: Display (max 2 lines truncated, full on hover/modal)
- Show: dependency_count, dependent_count, closed_at, created_at
- Display issue ID prominently
- Due dates: If set, highlight overdue in red, sort option available

**Chips & Badges**:
- Type chip: Lowkey spot top right
- Priority: Vertical along colored line
- Avoid too diverse colors/styles
- Agent chip: Prominent, better positioned, turn into proper chip

**Interaction States**:
- Hover: Show priority label, remove delete button and redundant date
- Selected/Active: Blue state should NOT obfuscate contents (reduce opacity/intensity)
- Dragging: Sophisticated drop states
- Keyboard focus: Show selection clearly

**Animations & Transitions**:
- Card move transition: Green glow border, scale bounce effect, elevated z-index
- Transport/teleport effect: 
  - Placeholder bead appears first (transitions from 0 to final size)
  - Smooth swap to target position
  - Moving bead height must match placeholder height
  - Placeholder should NOT stay after animation completes
  - No effect on bead shading/depth during zoom
- Hotkey icons: Should NOT show in background after resizing
- Micro animations: Add tiny, loving details throughout (use animation skill)
- Hover animations: Give more character (use animation skill)

### Modals & Panels

**Detail Panel**:
- NOT a popup modal overlay
- Inline slide-out panel from right (380px, scales on larger screens)
- Opens between columns, pushes furthest column out of viewport
- Board and panel sit side-by-side
- Smooth CSS transitions
- Currently editing card gets subtle accent background highlight
- Display all fields: design, acceptance, notes, comments
- Border-radius: Corners must be properly clipped

**New Issue Creation**:
- Same style as detail panel
- Spawn on left side of backlog column
- First tab focus: Title field
- Warn if typing and click away (unsaved changes)
- Hotkey: Communicate clearly
- "Create Issue" button: Same style as "New Issue" button

**Connection Visual** (REMOVED):
- Initial attempt: SVG shape with inverted border-radius connecting card to panel
- Status: User requested removal after iteration attempts

### Top Bar Design

**Elements**:
- Logo: Left side with depth/shading
- Search: Next to "New Issue" button
- Filters: Priority and Type dropdowns with glass effect (but subtle on small icons)
- Page links: About, Prompts, etc. (properly aligned)
- Night mode toggle, WebSocket status, question mark: Subtle (glass doesn't look good on small icons)
- Display active folder: "Strand Kanban - cwd: <cwd>"

### Mobile & Responsive

**Breakpoint**: 768px

**Mobile Features**:
- Stack columns vertically
- Column navigation dots
- Swipe gestures for column switching
- 44px minimum touch targets (Critical)
- Better touch target sizing throughout
- Swipe gesture improvements
- Panel dismissal gestures
- Alignment: Everything must align with same shape and height
- Chat pane: Feel native, optimized gestures and polish
- All elements: Proper alignment and consistency

**Safari macOS Compatibility**:
- Use `<meta name="theme-color">` tags for light/dark modes
- Browser-specific color handling for different modes

### Accessibility & Standards

- Fix all Svelte compiler warnings (~24 warnings)
- Interactive elements: Proper tabindex and keyboard handlers
- Labels: Associate with form controls
- Clean up unused CSS selectors (~15 in style block)
- Drag handlers: Proper ARIA roles
- NO Vim keybindings (explicitly rejected)
- Visible, non-interactive click elements: Add keyboard handlers or use proper interactive elements

## Explicit Rejections (What NOT to Do)

1. **DO NOT** ask questions - leave notes in issues instead
2. **DO NOT** use markdown TODOs - use `bd` CLI
3. **DO NOT** create new files unless absolutely necessary
4. **DO NOT** use Svelte stores - use Svelte 5 runes ($state, $effect)
5. **DO NOT** remove the beautiful agent chip design
6. **DO NOT** implement Vim keybindings
7. **DO NOT** make beads lighter when lightening dark mode background
8. **DO NOT** use try/catch for control flow
9. **DO NOT** stop working - keep fetching and completing tickets
10. **DO NOT** make detail panel a popup overlay/sidebar blocking board view
11. **DO NOT** touch the server when instructed to just work on tickets
12. **DO NOT** make glass effect prominent on small top-bar icons
13. **DO NOT** track implementation status in briefing - only end goals

## Positive Feedback (What to Preserve)

1. **Placeholder system works really well** for column transitions
2. **Agent chip design** - keep it beautiful
3. **Card counts in column headers** - effective feature
4. **Search/filter with dropdowns** - good implementation
5. **SSE live updates** - working well
6. **Drag-and-drop** - functional

## Workflow & Process Rules

### Development Process
- Read CLAUDE.md first - treat as law
- Run repomap or examine codebase structure before coding
- Edit existing files only unless absolutely necessary
- Keep functions <20 lines, single responsibility
- Minimal changes only
- Run lint before committing
- Commit after each bead completion
- Follow repository structure (see beads-kanban-xn4 for reorganization)

### Agent Workflow
- Use agents for all development (don't code yourself)
- Spawn agents in CAV (Claude Agent Viewer)
- Use design skill when working on design tasks
- Use frontend design skill for UI polish
- Use animation skill for character in animations
- Use usability skill for UX review
- Use session analyzer for extracting patterns

### Issue Management with Beads
- Always use `bd` CLI, never markdown TODOs
- Use `bd prime` to load workflow context after compaction
- Add comments to issues for feedback/notes
- Format: `BEAD_DONE: <bead-id> - <brief summary>` when complete
- Priorities: 1 (highest) to 4 (lowest)
- Use labels for virtual columns (draft, feedback, review)

### Continuous Work Loop
- Watch for tickets continuously
- Do not ask questions - leave notes in issues
- Do not stop working
- Pick most prioritized frontend issues
- If no beads available: pause 1 minute, check, repeat
- Automated reminders to keep distributing tasks
- Only work on non-task types when instructed

### Communication
- `BEAD_DONE:` notifications when completing work
- `TASK_DONE:` for larger task completions
- Leave feedback in issue comments
- Read comments on issues before working (`bd comments <issue-id>`)

## Features & End Goals

### Core Kanban Functionality

**Columns**:
- Standard: Backlog (with draft/feedback/review virtual sections), Open, In Progress, Blocked, Closed
- Virtual columns via labels: Draft, Feedback, Review (map to open status)
- Column features: Card counts, collapse/expand (persist in localStorage), sort options
- No issues placeholder: Should not be affected by drag-n-drop

**Card Management**:
- Drag-and-drop between columns with sophisticated states
- Edit modal/panel with all fields
- Delete functionality
- Create new issues
- Copy to clipboard: ID and descriptions
- Display all available beads data

**Search & Filter**:
- Search bar: Filter by title, description, AND bead ID
- Priority filter dropdown (All, P1-P4)
- Type filter dropdown (All types)
- Filters work together
- Show filtered-out items in transparent disabled state (not confusing empty view)

**Live Updates**:
- SSE streaming for real-time changes
- 5-second polling fallback
- WebSocket feed integration
- UI for WebSocket feed with pane activity
- Polish: Streaming delta text, status indicators, smooth transitions

### Keyboard Navigation & Shortcuts

**Card Navigation**:
- Arrow keys: Move between cards
- Enter: Edit selected card
- Delete/Backspace: Remove card
- N: New issue
- Escape: Deselect
- T, /, ?: Other functions
- Hotkey for create issue

**Hotkey Display**:
- Show hotkey hints in context (not separate help section)
- Subtle way to show single letters next to relevant items
- Most relevant steps always under a key
- Card hotkey UI: Simplified, not overlapping, not cluttering

### Advanced Features

**Issue Dependencies**:
- Show blocked-by indicators on cards
- Display actual issue titles for dependencies (not just counts)
- Prevent moving blocked issues to closed
- Visual dependency lines (nice-to-have)
- Show links with other issues at a glance
- Context menu: Draggable rope element to create relations
- Controls to remove relationships

**Context Menu**:
- Quick change: Priority, type
- Draggable relation creator (NOT drag to link with blue dot - rejected style)
- Respect dark/light mode

**Routing & Deep Linking**:
- Paths for issues: `/issue/[id]` or query params
- Auto-open issue from URL
- Update URL when opening/closing panels
- Browser back/forward navigation support

**Informational Pages**:
- About the project
- Differences from VibeKanban
- Suggested prompts
- Show pages on board interface

**Warnings & Notifications**:
- Unsaved changes when clicking away from new issue
- Warn when viewed issue is closed by another user/session

**Comments**:
- Display in edit panel
- Add new comments
- Full comment history

**Attachments** (Epic - Future):
- Attach files to issues
- Store and retrieve through detail pane

### Chat Pane / Agent Interface

**Core Functionality**:
- WebSocket connection to kanban_claude (port 9347)
- Parse daemon events (init, pane_added, message, delta, status)
- Show live pane status and messages
- Handle reconnection on disconnect
- Console logging for WebSocket events

**Commands** (Full suite):
- List panes
- Get pane status
- Add pane
- Send message to pane
- Get pane output
- Remove pane
- Fire-and-forget async handling (rely on broadcast events)

**UI Requirements**:
- Treat panes like chats
- Show full message history
- Pin in small form to bottom of screen
- Collapsible/expandable
- Resizable and movable windows
- Native-feeling interactions on mobile
- NO weird dragger in corner
- Subtle borders (not too defined)
- Respect dark/light mode (currently doesn't)
- Connected/Offline status indicator
- "Add agent..." input field
- Must maintain session history (no restart per message)

### Build & Deploy

**Development**:
- Vite dev server (HMR disabled)
- Local: `http://localhost:5173/`
- Network: Expose with `--host`
- Support for hosts like m2.local

**Global Command**:
- Shell alias/function: `beads-kanban [folder]` runs on any directory

**Favicon**:
- Add favicon.ico (currently 404)

**Documentation**:
- CLAUDE.md for future Claude instances
- Extended categories covering Beads integration
- WEBSOCKET.md (already created)

### Known Issues to Address

- Teleport animation: Placeholder height must match incoming bead
- Shadow clipping by containers
- Left border not clipped by border-radius in some states
- Column card overflow/crowding when too many issues
- Edit pane corners not clipped by radius
- Banding in color gradient overlay
- PATCH endpoint errors with invalid flags
- Safari compatibility improvements
- Monolith files need refactoring
- Session history not persisting in chat
- Process undefined error in wsStore