# Accumulated Briefing

**Progress:** 2/2 chunks processed

---

# Project Briefing: Strand Kanban

## Project Identity & Purpose
A Kanban board application (renamed from "beads-kanban" to "Strand Kanban") that integrates directly with the Beads issue management system. The board provides a visual interface for managing Beads issues through their CLI interface, featuring real-time updates via WebSocket agent connections, full CRUD operations, and live activity feeds from Claude agents. This project uses Beads for its own project management. The application supports opening multiple agent panes through a WebSocket bridge (kanban_claude), displaying live activity and status updates in a persistent bottom chat bar with native-feeling interactions.

## Tech Stack & Architecture
- **Framework**: SvelteKit 5
- **UI Library**: Svelte 5 with runes (`$state`, `$effect` - NOT stores)
- **Backend Integration**: Beads CLI (`bd` commands)
- **Agent WebSocket Bridge**: Connects to kanban_claude daemon on `ws://localhost:9347` (Claude Agent SDK based)
- **Pane Bridge**: Unix socket bridge for agent communication and streaming output
- **Project Location**: `/Users/jurrejan/Documents/development/_management/beads-kanban`
- **Sibling Project**: `kanban_claude` folder (port 9347) - uses Claude Agent SDK for running agents
- **Development Server**: Vite (HMR disabled per user preference)
- **Local Development URL**: http://localhost:5173
- **Network Access**: Can be exposed via `--host` flag for network connections
- **Global Access**: Shell alias/function to run Strand Kanban on any project folder (e.g., `strandkanban <folder>`)

### Beads CLI Integration
- List issues: `bd list --json`
- Update issue status: `bd update <id> --status <status>`
- Update issue properties: `bd update <id> --title "..." --description "..." --priority <p> --acceptance "..." --design "..." --notes "..."`
- Note: `--type` flag is NOT supported by `bd update` (only available on create)
- Close/delete issue: `bd close <id> --reason "Deleted from Kanban"`
- Status values: `open`, `in_progress`, `blocked`, `closed`
- View comments: `bd comments <issue-id>`
- Add comment: `bd comments add <issue-id> "comment text"`
- Initialize beads: `bd init` with optional prefix parameter for issue naming (e.g., "myproject" creates myproject-1, myproject-2)

### Agent WebSocket Bridge & Daemon Protocol
**Connection**: `ws://localhost:9347` to kanban_claude daemon (Claude Agent SDK based)

**Commands** (fire-and-forget model - rely on broadcast events for responses):
- `panes` - List all active panes/agent instances
- `status` - Get current daemon status
- `add` - Add new pane with `{ action: "add", name: "pane-name" }`
- `send` - Send message to pane with `{ action: "send", pane: "name", message: "text" }`
- `get` - Get pane output/history with `{ action: "get", pane: "name" }`
- `rm` - Remove pane with `{ action: "rm", pane: "name" }`

**Events** (daemon broadcasts):
- `init` - Initial connection
- `pane_added` - New pane created
- `message` - New message from pane
- `delta` - Streaming text delta (incremental message update)
- `status` - Status change
- Response format: `{ type: "response", data: { ok: boolean, ... } }`

**Logging**: WebSocket connection should log:
- "connecting" on initial connection
- "connected" on successful connection
- "error" on connection failures
- Message events for monitoring activity

### Vite Configuration
- Allow network hosts: Add `"m2.local"` to `server.allowedHosts` in vite.config.js for external access
- favicon.ico: Must be properly configured or requests will return 404

### Issue Data Structure
Issues contain:
- `id` - unique identifier (must be displayed on cards)
- `title` - issue title
- `description` - issue description (must be displayed and editable)
- `status` - one of: open, in_progress, blocked, closed, draft, feedback, review (custom statuses map to open internally in Beads)
- `priority` - numeric value 0-4 (0=highest)
- `issue_type` - type classification (task, bug, feature, epic, chore)
- `dependencies` - blocked-by relationships with other issues
- `due_date` - optional due date (if set)
- `created_at` - creation timestamp
- `updated_at` - last update timestamp
- `closed_at` - completion timestamp (for closed issues)
- `dependency_count` - number of issues this issue blocks
- `dependent_count` - number of issues blocking this issue
- `assignee` - assigned user
- `labels` - issue labels/tags
- `comments` - issue comments/discussion (fetched separately per issue)
- `design` - design field from Beads
- `acceptance` - acceptance criteria field from Beads
- `notes` - notes field from Beads
- `attachments` - file attachments (to be implemented)
- Any other metadata available from Beads CLI

## Design Philosophy & Preferences

### Core Aesthetic
- **Modern, polished UI reflecting current design standards** (state-of-the-art/SOTA)
- **Apple-inspired design** - think like Apple would design it
- **Playful, non-serif bold typography** (see Strand Kanban logo naming)
- **Sophisticated, state-of-the-art (SOTA) design aesthetic**
- **Advanced drop states and drag interactions** with smooth visual feedback
- **Full-screen layout** - columns should fill available screen space
- **Information density** - show more issue metadata when space permits
- **Dynamic, soft colorful background tones** focusing colors around middle and top, becoming lighter at edges
- **VERY light aesthetic** - background much lighter than current, especially for light mode
- **Don't lighten the beads themselves** - only lighten the background/surrounding areas

### Color & Theming
- **Dark mode theming** using CSS custom properties
- **Night/day theme switch** - toggle between light and dark themes in header
- **Theme persistence** - store theme preference in localStorage
- Both light and dark color schemes supported
- **Chat bar at bottom must match current theme** (not always black)
- **Dark mode background** should be slightly lighter/not too dark
- **Logo** - white or faint tint with hard 0.5px shadow (not soft)
- **Form elements** - subtle shading with 0.5px borders and shadows, fresher appearance, more contrast-balanced
- **Meta theme tags**: Send different color values based on browser's light/dark mode preference
  - Light mode: `<meta name="theme-color" content="[light-color]" media="(prefers-color-scheme: light)">`
  - Dark mode: `<meta name="theme-color" content="[dark-color]" media="(prefers-color-scheme: dark)"`

### Shadows & Depth
- **Subtle depth effect** on beads using 0.5px transparent shading line around (top white, bottom black)
- **Subtle, quite distanced shadow** behind each bead (not extreme, not clipped by containers)
- Zoom effects on beads should not affect shadow layering
- Border radius and shadows must align correctly (not larger than intended)
- No banding in color gradient overlays

### Typography & Text Alignment
- **Title and description rebalancing** - description should be noticeably smaller than title
- **All text in top bar must align** regardless of container sizes (bottom of text aligns)
- Page links text should align with other elements
- Priority labels displayed in **tiny monospace font**, full word (not abbreviation), colored to match priority, written along colored line with margin
- **Active folder displayed in title**: "Strand Kanban - cwd: <cwd>"
- **Hotkey hints** - minimal display (should NOT clutter interface or show overlay with all shortcuts)

### Icon & Component Positioning
- **Type icon alignment** with beads ID, not too far into corner
- **Priority label** scaled down, displayed along colored line with margin
- **Label placement** - bottom right corner on cards
- **Active agent label** - top right corner (initially visible, but hidden from "in progress" and "blocked" columns, shown only in "in progress" column when issue is being worked on)
- **Dropdown, question mark, nightmode, and websocket status** icons - glass effect removed, made more subtle
- **New issue button** - integrated into left side or first column (Backlog), part of the board layout

### Form & Input Elements
- **Compose pane styling** - fresh, light colored tones; bottom section (save/delete) redesigned to be more integrated
- **Form input fields** - more fresh appearance, better integration with surrounding UI
- **New issue panel contrast** - "New Issue" title needs better contrast against background
- **Focus state on new issue creation** - first tab should be title field (autofocus)

### Transitions & Animations
- **Smooth CSS transitions** for panel animation (when inline detail panel opens/closes)
- **Card movement transitions** with enhanced visual feedback
- **Green glow border effect** on cards that change status
- **Scale bounce animation** to draw attention to moved cards
- **Elevated z-index** during transition for prominence
- **Subtle micro-animations** throughout the UI (button hovers, state changes)
- **Bead transition placeholder** system for column transitions:
  - Placeholder appears as transparent red in debug mode
  - Placeholder should transition from 0 to final size BEFORE teleport starts
  - Placeholder stays visible during transport
  - Height of target bead placeholder must match the actual height of incoming bead
- **Zoom/scaling hover animations** with more character
- **Teleport strobe effect** - visual indication of card moving between columns (can be enabled via console command for testing)
- **Dropdown animations** for visibility transitions

### Layout & Spacing
- **Full-screen columns** filling available space
- **Column header card counts** displayed inline (format: "Open (3)")
- **Collapsible columns** with expand/collapse functionality, state persisted in localStorage
- **Chat bar at bottom** should not overlap with main UI; active body container should not reach beyond chat bar
- **Resizable and movable pane windows** for agent activity
- **Pane cards** pinned to bottom of screen in collapsible form
- **More history display** for pane messages (treat panes like chat threads)
- **Chat pane native feel** - polished interactions that feel native to the platform
- **Mobile responsive layout**:
  - Columns stack vertically on mobile (breakpoint at 768px)
  - Touch targets minimum 44px
  - Navigation dots for switching between columns on mobile
  - Swipe gestures for column navigation (left/right)
  - Panel dismissal via gestures
  - Proper alignment and consistent sizing across elements

### Mobile Optimization
- **Touch targets**: All interactive elements must be at least 44px tall/wide
- **Responsive stacking**: Columns stack vertically on devices below 768px
- **Touch-friendly navigation**: Swipe left/right between columns
- **Panel gestures**: Dismiss panels with swipe or tap outside
- **Font sizing**: Increase font sizes slightly for mobile readability
- **Spacing**: Increase gaps between elements for touch accuracy
- **Nothing is aligned or has the same shape or height**: Mobile layout must be properly aligned with consistent heights and shapes across all elements
- **Polish without changing fundamentals**: Optimize existing design, don't change what works well

## Explicit Rejections & Corrections
- **NO popup modals** - Use inline detail panel instead for editing issues
- **NO overlay blocking kanban view** - Board and panel should sit side-by-side
- **NO sidebar panels** - Panel opens in between columns, pushing furthest column out of viewport
- **NO visual SVG connection** between card and detail panel (feature removed after implementation)
- **Do NOT change the beautiful active agent chip styling** (reverted after unwanted change)
- **Do NOT use glass morphism** on small icons (dropdown, question mark, nightmode, websocket status) - make more subtle
- **Do NOT apply white background** to top bar/menu bar
- **Do NOT use contrasting weight and colors** for app branding (old beads-kanban style)
- **Do NOT use orange diamond** in logo
- **Do NOT keep red bead placeholder visible** in production (debug feature only)
- **Do NOT show hotkey icons** in background after bead resizing
- **Do NOT use "no issues" placeholders** that can be affected by drag and drop
- **Do NOT lighten the beads** - only lighten background/surrounding areas
- **Do NOT implement Vim keybindings** - simplified hotkey system only (n for new, t for transport, / for search, ? for help, arrows for navigation, etc.)
- **Do NOT show overlay with all available keyboard shortcuts** - hotkey hints should be minimal and contextual, integrated into UI subtly
- **Do NOT make the chat pane look bad** - weird corners/borders should be removed; pane should feel polished and native

## Positive Feedback to Preserve
- **Placeholder system works really well** for column transitions
- **Transport effect animation** targets placeholder correctly
- Column transition animations are in the right direction visually
- The basic WebSocket agent activity sidebar with streaming delta text works well
- Better status indicators and smooth transitions on pane activity
- **Active agent chip styling** looks great (do not change)
- **Placeholder system for bead transitions** - positive feedback, continue using this approach
- **Don't change a good thing but polish it** - iterative refinement over major redesigns

## Workflow & Process Rules
- User acts as "manager agent"
- Manager agent should proactively find and distribute tasks
- Delegate development work to agents in CAV (Claude Agent Virtualization)
- Developer should not code directly; spawn agents for implementation
- Use design skill proactively when working on design/styling tasks
- Continue working and distributing tasks autonomously
- Use Beads to manage this project itself
- Get tickets from Beads and distribute to workers
- Brief workers before assigning tasks
- **Always keep fetching tickets** - do not ask questions, do not stop
- **Commit after each bead completion** with message format: `BEAD_DONE: <issue-id> - <brief summary>`
- **Watch for new tickets continuously** - pause 1 minute between checks if none available, loop until new tickets appear
- **Only work on non-task tickets** (bugs, features, epics, etc.) - skip task tickets unless user specifically requests
- Agent rules for all tasks:
  - Read CLAUDE.md first, follow all rules
  - Run repomap or examine codebase structure before coding
  - Edit existing files only - no new files unless absolutely necessary
  - Keep functions <20 lines, single responsibility
  - NO try/catch for control flow
  - Minimal changes only
- Agents must notify completion with: `BEAD_DONE: <issue-id> - <brief summary>`
- **Create CLAUDE.md file** documenting:
  - Common commands (build, lint, run tests, single test execution)
  - Development setup instructions
  - High-level code architecture and structure
  - Codebase organization and key directories
  - Patterns and conventions used
  - How to extend the project

## Features & End Goals

### App Launch & Accessibility
**Cross-Project Support**
- Shell alias/function to launch Strand Kanban on any project folder
- Global OS-wide command (e.g., `strandkanban <folder>`)
- Display active working folder in window title: "Strand Kanban - cwd: <cwd>"
- Enables quick access to any Beads project
- Can initialize Beads in a directory if not already initialized

**macOS Safari Compatibility**
- Add meta tags for theme color in HTML head
- Support light/dark mode: separate theme-color tags for light and dark modes
- Format: `<meta name="theme-color" content="#FF5733" media="(prefers-color-scheme: light)">`
- Format: `<meta name="theme-color" content="#3333FF" media="(prefers-color-scheme: dark)">`
- Improves Safari address bar color matching

### API Endpoints
**GET /api/issues** (`src/routes/api/issues/+server.ts`)
- Executes `bd list --json` to retrieve all issues from real Beads data
- Returns complete issue data including all available metadata
- Returns: `{issues: [...]}`
- Includes POST handler for creating new issues

**POST /api/issues** (`src/routes/api/issues/+server.ts`)
- Creates new issues in Beads
- Request body should include title, description, priority, status, issue_type

**PATCH /api/issues/[id]** (`src/routes/api/issues/[id]/+server.ts`)
- Updates issue properties via `bd update <id>` with appropriate flags
- Request body can include: `status`, `title`, `description`, `priority`, `design`, `acceptance`, `notes`
- Do NOT attempt to use `--type` flag (not supported in bd update)
- Updates all editable issue properties

**DELETE /api/issues/[id]** (`src/routes/api/issues/[id]/+server.ts`)
- Closes issue via `bd close <id> --reason "Deleted from Kanban"`
- Returns: `{success: true}`

**SSE Endpoint** (`src/routes/api/issues/+server.ts`)
- Provides Server-Sent Events for live updates
- Enables real-time synchronization of issue changes across clients
- Streams issue updates to all connected clients

### Kanban Board UI Component
**Main Page** (`src/routes/+page.svelte`)
- Visual Kanban board with customizable columns displaying issues organized by status
- **Full-screen layout** - columns fill available screen space
- Drag-and-drop functionality between status columns with visual feedback
- Fetches issues from GET /api/issues using real Beads data
- Updates issue status via PATCH /api/issues/[id]
- Real-time updates via SSE
- Sophisticated, state-of-the-art visual design with advanced drop states
- Dynamic, soft colorful background with color focus on middle/top

### Custom Status Columns
- **Beads custom statuses**: Support draft, feedback, review, backlog, in_progress, done, etc.
- **Mapping strategy**: Map custom display statuses to Beads-supported statuses
  - Example: "Draft", "Feedback", "Review" columns map internally to `open` status in Beads
  - Use hidden labels or internal mapping so Beads only sees `open`/`in_progress`/`blocked`/`closed`
- **Display customization**: Show custom status names as full columns in UI even if internally mapped differently
- **Column count**: Support 4+ columns beyond initial defaults (Open, In Progress, Blocked, Closed)

### Column Features
- **Display card count in each column header** (format: "Open (3)" or "In Progress (5)")
- Count updates automatically as issues change
- Implementation: inline filter in h2 tag `{column.label} ({issues.filter(i => i.status === column.key).length})`
- **Collapsible columns** with expand/collapse functionality
- Persist column collapse state in localStorage
- **Clean column headers**: When lanes are collapsed, maintain clean visual presentation
- **Subtle sort option** for each column (hidden/low-key)
- Custom sort by due date within columns

### Issue Cards
- **Display issue ID prominently** on card
- Display issue title
- Display truncated description (max 2 lines) below title
- Show full description on hover or in detail panel
- Click card to open inline detail panel for editing
- **Display due dates** on cards if set in Beads
- **Highlight overdue items** in red
- **Show actual issue titles for dependencies** instead of just counts
- Show dependency relationships with linked issue titles

**Card Metadata Display** (adaptive information density):
- `created_at` - creation timestamp
- `updated_at` - last update timestamp
- `closed_at` - completion timestamp (for closed issues)
- `dependency_count` - number of issues this issue blocks
- `dependent_count` - number of issues blocking this issue
- `dependencies` - actual issue titles, not just counts
- `assignee` - assigned user
- `labels` - issue labels/tags
- Comment count/indicators
- All other relevant Beads metadata

**Card Visual Design**:
- **Subtle depth effect** using 0.5px transparent shading line (top white, bottom black)
- **Subtle, distanced shadow** behind each card (not clipped by containers, maintains shadow during animations)
- Type icon positioned with ID (not far into corner)
- **Priority label** - tiny monospace font, full word, colored to match priority, along colored line with margin
- **Label** - bottom right corner
- **Active agent label** - top right corner (shown only in "in progress" column when actively being worked)
- **Currently editing card** gets highlighted with subtle accent background
- Cards should not be crowded (if many issues in column, use scrolling/virtualization)

### Card Movement Transitions
- **Enhanced visual transition animation** when a card moves in real-time
- **Green glow border effect** on cards that change status
- **Scale bounce animation** to draw attention to moved cards
- **Elevated z-index** during transition for prominence
- **Placeholder system** for smooth column transitions:
  - Placeholder appears in target column before card moves
  - Card transition animation moves card to placeholder position
  - Card achieves smooth swap with placeholder
  - Placeholder transitions from 0 to final size before teleport starts
  - **Placeholder height must match actual incoming bead height** for seamless visual transition

### Edit Functionality (Inline Detail Panel)
- Click card to open inline detail panel
- Panel design:
  - Opens in between columns (not as sidebar)
  - Pushes furthest column out of viewport
  - Panel width scales appropriately on larger screens
  - Smooth CSS transition animations
  - Header shows issue ID with priority color bar, or "New Issue" title
  - Visual status selector
- **Edit capabilities**: title, description, priority, status, design, acceptance, notes
- **Comments section** in detail panel:
  - Display existing comments
  - Add new comments
  - Full comment thread for the issue
- **Warn on unsaved changes** - if user clicks away while typing in create/edit panel, show warning
- **Warn on issue closure** - if issue is closed by another user/session while viewing in detail pane, notify user
- Save changes via PATCH /api/issues/[id]
- Currently editing card gets highlighted on board with subtle accent background

### Delete Functionality
- Delete button/option available from card or inline detail panel
- Confirmation before deletion
- Executes DELETE /api/issues/[id]

### Create Issue Functionality
- Add new issue button integrated into left side or first column (Backlog)
- Opens inline detail panel with "New Issue" title
- **First tab/focus should be title field** (autofocus)
- Form to input: title, description, priority, status, issue_type
- Creates issues via POST /api/issues
- Issues created through web UI should appear immediately in the board
- **Same styling as edit panel** for consistency
- **Panel spawned on left side of backlog** column

### Search & Filter Functionality
- **Search input in header** that filters issues by title OR description
- **Search should match Beads IDs** in addition to titles/descriptions
- **Filter dropdowns** for:
  - Priority: All, P0, P1, P2, P3, P4
  - Type: All, task, bug, feature, epic, chore
- Filters work together (search + priority + type combined)
- Use Svelte 5 `$state` runes for filter state management
- **Search state feedback** - when using search with no results, show all other tickets in transparent/disabled state (not just empty)
- **All form elements in top bar** - subtle shading with 0.5px borders, shadows, fresher appearance

### Sorting & Organization
- **Sort by due date** option within columns
- Default sorting supports due date prioritization
- Hidden/subtle sort controls in each column

### Keyboard Shortcuts
- **Arrow keys**: Navigate between cards (up/down/left/right)
- **Enter**: Edit selected/focused card
- **Delete/Backspace**: Remove selected card
- **N key**: Create new issue
- **T key**: Teleport/transport action
- **/ key**: Search focus
- **? key**: Show help
- **Escape**: Deselect current card
- **Hotkey hints** - minimal, contextual display (NOT an overlay showing all shortcuts)
- Power user productivity focus
- Help page documenting all available hotkeys

### Dependency Management
- **Prevent moving blocked issues** to closed status
- Display blocked-by indicators on cards
- Show dependency_count and dependent_count on cards
- **Show actual issue titles for dependencies** instead of just counts
- **Link with other issues at a glance** - dependencies clearly visible
- **Context menu features** to manage relationships:
  - Right-click context menu on cards
  - Quickly change priority, type, status
  - **Draggable rope-like element** in context menu for linking issues
  - Drag rope toward another bead to create relationship/dependency
  - Context menu respects dark/light mode theming
- **Control to remove relationships** between beads
- Visual dependency indicators or connections between related cards

### Live Updates & WebSocket Agent Integration
- **Real-time synchronization** using Server-Sent Events (SSE)
- Ensures all connected clients see issue changes immediately
- Eliminates need for polling mechanism
- Changes made by other clients or external Beads CLI appear in real-time

**Agent WebSocket Activity Sidebar** (bottom chat bar):
- Display connected/offline status indicator
- Show list of active agent panes/instances
- **Treat agent panes like chat threads** - display full message history
- **Streaming delta text** - incremental message updates displayed smoothly
- Better status indicators for agent state
- Smooth transitions for new messages
- Resizable and movable pane windows
- **Pane cards pinned to bottom** in collapsible form
- Add pane input field with "Add agent..." placeholder
- **Chat pane feels native** - polished, smooth interactions
- **UI controls** for:
  - Add new agent pane button
  - Remove pane button (per pane)
  - Message input for sending commands to panes
- Match current theme (light/dark mode)
- Should not overlap main kanban board
- Console logging for WebSocket events (connect, disconnect, errors, messages)
- **Chat session persistence**: Agent chat histories should persist across sessions
- **External connections**: Allow connecting to agents outside of kanban_claude

### Attachments Functionality
- Enable users to attach files (documents, images, screenshots, etc.) to issues
- Attachments should be stored with the issue
- Retrievable through the issue detail pane
- Support multiple file types (images, documents, etc.)
- Display attachment list in detail pane
- Ability to remove attachments

### Deep Linking
- **Add paths for deeplinking to issues**
- Support URLs that link directly to specific issues (e.g., `/issue/[id]`)
- Open detail panel automatically when accessing issue URL
- Update URL when opening/closing issue panels
- Support browser back/forward navigation
- Enable sharing of specific issue views

### Information Pages
- **About page** explaining the project
- Explain differences from Vibe Kanban
- **Suggested prompts page** showing tips/help
- **Help/question mark** interface showing available hotkeys and features
- Additional informational content accessible from main interface

### Mobile Responsive Layout
- **Media queries**: Mobile breakpoint at 768px
- **Vertical stacking**: Columns stack vertically on mobile devices
- **Touch targets**: Minimum 44px touch targets for mobile interaction
- **Column navigation**: Navigation dots for switching between columns on mobile
- **Swipe gestures**: Swipe left/right to navigate between columns
- **Panel dismissal**: Dismiss panels with swipe or tap outside
- Mobile-first responsive design approach
- Ensure usability on touch devices
- **Consistent sizing and alignment**: All elements properly aligned with consistent heights and shapes

### Repository Organization
- **Reorganize repo** to fix monolith files
- Break down large component files into smaller, manageable modules
- Improve code structure and maintainability
- Follow SvelteKit best practices

### Accessibility Standards
- Interactive elements with click handlers must have keyboard event handlers
- Use semantic interactive elements (`<button type="button">` or `<a>`) over non-interactive elements
- All keyboard shortcuts properly implemented
- Hotkey hints visible and accessible
- Color contrast meets WCAG standards
- Labels associated with form controls
- Fix all Svelte compiler warnings (24+ accessibility and CSS warnings)
- Non-interactive elements with drag handlers need ARIA roles

### Code Documentation
- **CLAUDE.md file** with:
  - Build commands: `npm run build`
  - Development command: `npm run dev`
  - Lint command and how to run
  - Test command and how to run single tests
  - Development setup and prerequisites
  - High-level architecture overview
  - Key directories and file organization
  - Patterns and conventions (Svelte 5 runes, store usage, API patterns, etc.)
  - How to extend features (add new columns, add new endpoints, etc.)
  - Environment setup (ports, hosts, dependencies)

---

## Current Open Tickets for Reference
- **beads-kanban-37z**: Fix Svelte Warnings (24+ accessibility and CSS warnings)
- **beads-kanban-zjx**: Improve card hotkey ui (simplify hotkey display, not overlay)
- **beads-kanban-41k**: Add attachments functionality
- **beads-kanban-7rb**: Make New Issue button part of left side/board
- **beads-kanban-35y**: Warn on close (notify when issue closed while viewing)
- **beads-kanban-369**: Test virtual columns (draft/feedback/review labels)
- **beads-kanban-g39**: Clean up top of collapsed lanes
- **beads-kanban-ins**: Chat sessions persistence (agent messages should be retained)
- **beads-kanban-0c9**: Placeholder height matching in teleport animation