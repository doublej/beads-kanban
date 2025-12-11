# Accumulated Briefing

**Progress:** 9/9 chunks processed

---

# Project Briefing: Strand Kanban

## Project Identity & Purpose
A Kanban board application that integrates directly with the Beads issue management system. The board provides a visual interface for managing Beads issues through their CLI interface, featuring real-time updates and full CRUD operations. This project uses Beads for its own project management.

**Project Name**: Strand Kanban (renamed from "Beads Kanban")

**Key Differentiator from VibeKanban**: (To be documented in About page)

**Portable Usage**: Can be run on any folder containing a Beads database via shell alias/function (no code changes approach preferred)

**End Goal**: Create a FULL project specification with none of the noise, all of the facts, allowing an agent to rebuild this entire project without any confusion.

## Tech Stack & Architecture
- **Framework**: SvelteKit 5
- **UI Library**: Svelte 5 with runes (`$state`, `$effect` - NOT stores)
- **Backend Integration**: Beads CLI (`bd` commands)
- **Real-time Communication**: WebSocket connection to kanban_claude agent daemon (port 9347)
- **Agent Management**: kanban_claude (sibling folder) - Claude Agent SDK for running agents
- **Project Location**: `/Users/jurrejan/Documents/development/_management/beads-kanban`
- **Development Server**: Vite HMR disabled (per user preference)
- **Local Development URL**: http://localhost:5173
- **Network Access**: External connections allowed (not localhost-only)
- **Allowed Hosts**: m2.local configured in vite.config.js

### Beads CLI Integration
- List issues: `bd list --json`
- Update issue: `bd update <id> --status <status> --title <title> --description <description> --priority <priority> --assignee <assignee> --design <design> --acceptance <acceptance> --notes <notes>`
- Close/delete issue: `bd close <id> --reason "Deleted from Kanban"`
- Prime workflow context: `bd prime` (loads AI-optimized workflow rules)
- View comments: `bd comments <issue-id>` (lists all comments with timestamps and authors)
- Add comment: `bd comments add <issue-id> "comment text"` (or use -f flag for file input)
- Initialize beads: `bd init [prefix]` (sets up new beads database with optional custom prefix)
- Status values: `open`, `in_progress`, `blocked`, `closed`
- **Note**: `bd update` does NOT support `--type` flag - issue_type cannot be updated via CLI

### WebSocket Architecture
- **Agent Daemon**: kanban_claude running on port 9347
- **Client**: WebSocket store (`wsStore.svelte.ts`) connects to `ws://localhost:9347`
- **Technology**: Claude Agent SDK for agent management
- **Response Format**: Agent SDK protocol
- **Event Types**: Agent lifecycle events, messages, status updates
- **Session Management**: Chat sessions must persist across messages (not restart every time)
- **Async Handling**: Fire-and-forget approach, rely on broadcast events
- **Console Logging**: Prefix logs with `[agent]` for easy filtering

### Issue Data Structure
Issues contain:
- `id` - unique identifier (must be displayed on cards and searchable)
- `title` - issue title
- `description` - issue description (must be displayed and editable)
- `status` - one of: open, in_progress, blocked, closed
- `priority` - numeric value 1-4
- `issue_type` - type classification (task, bug, feature, epic, chore) - NOT editable via CLI
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
- Any other metadata available from Beads CLI

## Design Philosophy & Preferences
- Use design skill when working on design tasks (specifically "frontend design skill")
- Use animation skill when working on animation tasks
- Use usability skill when reviewing mobile/UX aspects
- Use sessions history skill to extract user preferences and writing guides
- Use session analyzer to get all user messages and tickets for comprehensive analysis
- Delegate development work to agents in kanban_claude
- Developer should not code directly; spawn agents for implementation
- Support dark mode theming using CSS custom properties
- **Night/day theme switch** - toggle between light and dark themes
- **Theme consistency** - All UI elements (including chat bar, context menus) must match current theme (dark/light)
- **Browser-aware theme meta tags** - When browser is set to light mode, send different colors in meta tags for Safari address bar
- Mobile-first responsive design considerations
- Vite HMR should be turned off
- **Sophisticated, state-of-the-art (SOTA) design aesthetic**
- **Think: What would Apple do?** - Premium, polished design approach
- **NO boring 2005-era gradient elements and border radius styles**
- **Advanced drop states and drag interactions**
- **Modern, polished UI that reflects current design standards**
- **Full-screen layout** - columns should fill available screen space
- **Information density** - show more issue metadata when space permits
- **Proper border radius clipping** - Edit pane corners must respect border radius (no overflow)
- **Streaming delta text** in WebSocket UI for real-time updates
- **Better status indicators** for WebSocket connections
- **Smooth transitions** for all UI state changes
- **Micro-animations everywhere** - Add tiny UI animations throughout the interface like someone really loved working on it
- **Character in hover animations** - Use animation skill to enhance hover interaction personality
- **Chat bar should not overlap main UI** - Active body container must not extend beyond visible area when chat bar is present
- **Fresh, light-colored tones** - especially for input fields and action areas
- **Lowkey, cohesive styling** - avoid diverse colors and styles, maintain consistency
- **Proper container sizing** - all containers must have appropriate dimensions to display content
- **No white background on top bar/menu bar** - should be transparent or themed
- **No border under top bar** - cleaner appearance
- **Dynamic background with soft colorful tones** - focus colors around middle and top, lighter towards outside
- **Very light background** - lighter than initial implementations, but beads themselves should not be lighter
- **Fresh form elements** - not too grey, not too much contrast, appropriate sizing
- **Shading with .5px borders and shadows** on form elements in top bar
- **Console command access for teleport strobe** - ability to activate always for testing
- **Subtle depth on beads** - 0.5px transparent shading line around beads (top white, bottom black) - slightly more apparent than initial implementation
- **Glass effect subtlety** - Glass effect does not look good on small icons (dropdowns, questionmark, nightmode, websocket status) - make more subtle
- **Title/description balance** - Description should be smaller than title, more so than current implementation
- **Zoom effects should not affect shading** - Bead zoom effect should not affect the shading lines
- **Subtle shadow behind beads** - Quite distanced shadow behind each bead (not extreme, not clipped by containers)
- **Logo design** - White or faint tint, with light shading and depth
- **Logo typography** - Much bolder, playful, non-serif font for "Strand Kanban"
- **Logo shadow** - Hard 0.5px shadow, not a soft one
- **Debug visualization** - Placeholder beads shown as transparent red during development (can be toggled)
- **Dark mode background** - Should not be too dark (lighter than initially implemented)
- **Accessibility standards** - Fix all Svelte compiler warnings for accessibility and clean CSS
- **Simplified hotkey UI** - Card hotkey overlays should not clutter interface with too much information
- **Don't change a good thing but polish it** - Preserve what works, enhance without breaking
- **Native-feeling chat pane** - Chat interface should feel smooth and polished like a native app
- **Mobile optimization** - Everything must be aligned with consistent shapes and heights

## User Correction Patterns
The user frequently requests:
- **Iterative, careful, token-aware processes** - Breaking down large analysis tasks into manageable chunks
- **Extracting preferences and corrections** - Learning from past feedback to prevent repeated issues
- **Full briefings without noise** - Comprehensive documentation with all facts, no implementation status
- **Distinguishing between talking style and actionable corrections** - Focus on what to build, not communication patterns
- **End goals over current state** - Document what features SHOULD do, not broken/WIP status

## Explicit Rejections
- **NO popup modals** - Use inline detail panel instead for editing issues
- **NO overlay blocking kanban view** - Board and panel should sit side-by-side
- **NO sidebar panels** - Panel opens in between columns, pushing furthest column out of viewport
- **NO visual SVG connection between card and detail panel** - Feature removed after implementation attempts
- **NO outdated design patterns** - Avoid 2005-era gradients and border radius styles
- **NO obfuscating blue state** - Active bead highlighting should not obscure content
- **NO undefined variable references** - All variables (like `columnIssues`) must be properly defined before use
- **NO white background on top bar/menu bar**
- **NO border under top bar**
- **NO abbreviated priority labels** - Write full word
- **NO glow on priority labels**
- **NO grey, high-contrast form elements** - Must be fresh with appropriate sizing
- **NO removing beautiful active agent chip** - Preserve original design
- **NO contrasting weight and colors on logo** - Keep typography consistent
- **NO orange diamond on logo** - Removed from branding
- **NO extreme shadows** - Shadows should be subtle and distanced
- **NO clipped shadows** - Shadows must not be clipped by containers
- **NO clipped borders** - Left borders on beads must align with border radius
- **NO shading affected by zoom** - Zoom effects should preserve shading integrity
- **NO hotkey icons visible after resizing** - Icons should not appear in background after bead resize
- **NO drag effects on "no issues" placeholders** - Empty state placeholders should not respond to drag interactions
- **NO banding in color gradient overlay** - Background gradient must be smooth
- **NO lighter beads** - When making background lighter, keep bead color unchanged
- **NO Vim keybindings** - Explicitly rejected for hotkey system
- **NO pane bridge daemon (port 8765)** - Replaced with kanban_claude agent daemon
- **NO weird dragger in corner of chat pane**
- **NO very defined borders on chat pane** - Should be subtle, not lose quality when dragging
- **NO session restarts on every message** - Chat sessions must persist
- **NO misaligned mobile elements** - Everything must have consistent shapes and heights
- **NO tracking implementation status in briefings** - Focus on end goals, not broken/WIP state
- **NO noise in documentation** - Only facts and actionable specifications

## Design Patterns to Preserve
- **Inline detail panel** for issue editing:
  - Opens in between columns (not as sidebar)
  - Pushes furthest column out of viewport when opened
  - Panel width scales appropriately on larger screens
  - Currently editing card gets highlighted with subtle accent background
  - Smooth CSS transitions for panel animation
  - **Border radius must clip properly** - no corner overflow, left border must align with radius
  - Header shows issue ID with priority color bar, or "New Issue" title
  - **Good contrast for "New Issue" title** - Must be readable against blue background
  - Visual status selector in panel
  - **Save/delete section needs redesign** - bottom border doesn't fit rest of interface, needs fresh light-colored styling
- **Chat/Agent Interface**:
  - Native-feeling interaction quality
  - Pinned to bottom of screen in small, collapsable form
  - **Resizable** - Allow users to make windows larger/smaller
  - **Draggable** - Allow users to move windows around
  - **Theme-aware** - Match current theme (dark/light mode)
  - Smooth, polished appearance without weird corner draggers
  - Subtle borders, not overly defined
  - **Persistent sessions** - Chat sessions preserved across messages
  - Connected/Offline indicator visible
  - "Add agent..." input field
  - **Subtle glass effect** - Not overpowering on small UI elements
- **Console logging for WebSocket**:
  - Log connection events (connect, disconnect)
  - Log errors
  - Log messages
  - Prefix logs with `[agent]` for easy filtering
- **Beautiful active agent chip** - Original design must be preserved
- **Teleport strobe effect** - Smooth transport effect with placeholder swap for bead column switching transitions
- **Placeholder transition effect** - Placeholder should transition from 0 to final size before teleport starts
- **"New Issue" button style** - Create issue button should match the same style as New Issue
- **What works well** - Don't change good things, just polish them

## Accessibility Standards
- Interactive elements with click handlers must have keyboard event handlers
- Consider using semantic interactive elements (`<button type="button">` or `<a>`) over non-interactive elements with click events
- Labels must be properly associated with form controls
- Non-interactive elements with drag handlers need ARIA roles
- Fix all Svelte compiler accessibility warnings
- Clean up unused CSS selectors

## Workflow & Process Rules
- User identifies as a "manager agent"
- Manager agent should proactively find out what tasks need to be done
- Use agents for development tasks
- Spawn agents in kanban_claude environment
- Apply design skill when working on design-related tasks (frontend design skill)
- Apply animation skill when working on animation-related tasks
- Apply usability skill when reviewing mobile/UX aspects
- Apply sessions history skill to extract user preferences and writing guides
- Apply session analyzer to get comprehensive user message and ticket analysis
- Use iterative and careful token-aware processes for large analysis tasks
- Continue working and distributing tasks autonomously
- Use Beads to manage this project itself
- Get tickets from Beads and distribute to workers
- Brief workers before assigning tasks
- Use `bd prime` to load AI-optimized workflow context for beads tracking
- **Pick most prioritized frontend issues automatically** - Don't ask questions, leave notes in issues if needed
- **Work continuously** - Keep picking up frontend issues without stopping
- **Keep grabbing tickets** - continuously work through the backlog
- **Always keep fetching tickets** - never stop working
- **Watch for tickets, do not ask questions, do not stop**
- **Loop when no tickets**: pause 1 minute, check for beads, pause, check, repeat
- **Run lint first** before making changes
- **Read comments on issues** - check issue comments for context, especially for reopened issues
- **Fetch comments when referenced** - If ticket mentions "Feedback in comment", use `bd comments <issue-id>` to view
- **Commit after each bead** - Complete one ticket, commit, then move to next
- **Extract user corrections** - Learn from feedback to prevent repeated issues
- Agent rules for all tasks:
  - Read CLAUDE.md first, follow all rules
  - Run repomap or examine codebase structure before coding
  - Edit existing files only - no new files unless absolutely necessary
  - Keep functions <20 lines, single responsibility
  - NO try/catch for control flow
  - Minimal changes only
- Agents must notify completion with: `BEAD_DONE: <issue-id> - <brief summary>`
- **Don't touch the server** - work on tickets, not server infrastructure
- **Work on tickets, not tasks** - Focus on higher-priority work items
- **Clarify tickets for future Claude** - When not working, add clarity to ticket descriptions rather than implementing

## Documentation
- **WebSocket documentation** available at `docs/WEBSOCKET.md`
- Contains full coverage of WebSocket integration, commands, and usage
- **CLAUDE.md** - Instructions for future Claude instances working in this repository
  - Common commands (build, lint, test, development workflow)
  - High-level code architecture and structure
  - Big picture architecture patterns
  - Repository organizational patterns
- **Briefing should contain no noise, all facts** - Enable rebuilding entire project without confusion

## Repository Organization
- Needs reorganization to fix monolith files
- Clean up code structure for better maintainability

## Features & End Goals

### API Endpoints
**GET /api/issues** (`src/routes/api/issues/+server.ts`)
- Executes `bd list --json` to retrieve all issues from real Beads data
- Returns complete issue data including all available metadata:
  - Core fields: id, title, description, status, priority, issue_type
  - Timestamps: created_at, updated_at, closed_at
  - Dependencies: dependency_count, dependent_count, dependencies
  - Metadata: assignee, labels, due_date
  - Extended fields: design, acceptance, notes
  - Comments: fetched separately per issue
  - All other fields available from `bd list --json`
- Returns: `{issues: [...]}`
- Includes POST handler for creating new issues

**POST /api/issues** (`src/routes/api/issues/+server.ts`)
- Creates new issues in Beads
- Request body should include title, description, priority, status, issue_type

**PATCH /api/issues/[id]** (`src/routes/api/issues/[id]/+server.ts`)
- Updates issue properties via `bd update <id>` with appropriate flags
- Supported fields: `status`, `title`, `description`, `priority`, `assignee`, `design`, `acceptance`, `notes`
- **Cannot update `issue_type`** - bd update does not support --type flag
- Updates all editable issue properties using correct CLI flags
- Returns: `{success: true}` or error details

**DELETE /api/issues/[id]** (`src/routes/api/issues/[id]/+server.ts`)
- Closes issue via `bd close <id> --reason "Deleted from Kanban"`
- Returns: `{success: true}`

**SSE Endpoint** (`src/routes/api/issues/+server.ts`)
- Provides Server-Sent Events for live updates
- Enables real-time synchronization of issue changes across clients
- Streams issue updates to all connected clients

### Agent Integration (`wsStore.svelte.ts`)
- Connect to kanban_claude daemon at `ws://localhost:9347`
- Handle Claude Agent SDK protocol
- Full agent lifecycle management:
  - Spawn new agents
  - Send messages to agents
  - Receive agent responses
  - Track agent status
  - Remove agents
- Fire-and-forget async handling (rely on broadcast events)
- Console logging for all agent events ([agent] prefix)
- **Persistent sessions** - Chat sessions must not restart on every message
- Process incoming event types from Agent SDK

### Agent UI Controls (Chat Interface)
- **Native-feeling chat interface**:
  - Treat agents as chat conversations
  - Show full message history
  - Pinned to bottom of viewport
  - Collapsable interface
  - **Resizable** - Users can make windows larger/smaller
  - **Draggable** - Users can move windows around screen
  - **No weird corner draggers** - Clean, polished dragging experience
  - **Subtle borders** - Not overly defined, don't lose quality when dragging
  - Dark bar with Connected/Offline status indicator
  - "Add agent..." input field for adding new agents
  - **Theme-aware styling** - Matches current dark/light mode theme
  - **No overlap with main UI** - Body container respects chat bar height
  - Streaming delta text display
  - Better status indicators with smooth transitions
  - Add/remove agent controls
  - Message input for sending to agents
  - Polished, modern UI aesthetic
  - **Fresh, light-colored input fields** - avoid grey, out-of-place styling
  - **Redesigned save/delete section** - better fitting with rest of interface
  - **Subtle glass effect on icons** - More subtle than previous implementation

### Kanban Board UI Component
**Main Page** (`src/routes/+page.svelte`)
- Visual Kanban board with multiple columns displaying issues organized by status
- **Extended column set** - Support for additional workflow stages:
  - **Virtual columns** - Draft, Feedback, Review (map to underlying Beads statuses via labels)
  - Draft/Feedback/Review columns display as full columns in UI
  - Backend mapping: these virtual columns map to `open` status in Beads with corresponding labels
  - Labels act as hidden layer - combined with status creates visual column organization
- **Full-screen layout** - columns fill available screen space
- **Handle column crowding** - prevent issues from crowding when too many in one column
- **Clean collapsed column UI** - Top side of swimming lanes should be clean and organized when some lanes are collapsed
- **Proper shadow rendering** - card shadows must not be clipped by containers
- Drag-and-drop functionality between status columns
- Fetches issues from GET /api/issues using real Beads data
- Updates issue status via PATCH /api/issues/[id]
- Real-time updates via SSE (replaces or supplements polling)
- Sophisticated, state-of-the-art visual design
- Advanced drop states with clear visual feedback during drag operations
- Apple-level design quality and polish
- **Dynamic background** - soft colorful tones focused around middle and top, lighter outside
- **Very light background** - lighter than initial implementations, beads stay same color
- **Smooth gradient** - no banding artifacts in color overlay
- **No white background on top bar** - transparent or themed
- **No border under top bar**
- **Display active folder in title** - Format: "Strandkanban - cwd: <cwd>"

### Header & Branding
- **Logo**: "Strand Kanban"
  - Much bolder, playful, non-serif font
  - White or faint tint color
  - Light shading and depth
  - Hard 0.5px shadow, not soft
  - No contrasting weights or colors
  - No orange diamond
  - **Try alternative fonts** - Experiment with different font options
- **New Issue button** - Positioned on left side or as part of first column (Backlog)
- **Small icons** (dropdowns, questionmark, nightmode, websocket) - More subtle glass effect
- **Page navigation links** in top bar:
  - Must align properly with all other text
  - Text baseline alignment regardless of container size
  - Links should not be too dark
  - Pages must be visible/accessible on the board

### Informational Pages
- **About page**:
  - Explain the project purpose
  - Describe how Strand Kanban differs from VibeKanban
- **Suggested prompts page**:
  - Provide helpful prompt examples for users
  - Guide users on effective usage

### macOS Safari Compatibility
- Add `<meta name="theme-color">` tag for Safari address bar theming
- Support both light and dark mode with separate meta tags:
  ```html
  <meta name="theme-color" content="#XXXXXX" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#XXXXXX" media="(prefers-color-scheme: dark)">
  ```
- **Browser-aware theme colors** - When browser is set to light mode, send different colors in meta tags
- Ensure Safari tab bar reflects the application theme
- **Favicon support** - Serve favicon.ico to prevent 404 errors

### Column Features
- Display card count in each column header (format: "Open (3)" or "In Progress (5)")
- Count updates automatically as issues change
- Implementation: inline filter in h2 tag `{column.label} ({issues.filter(i => i.status === column.key).length})`
- Helps users quickly see workload distribution across statuses
- Collapsible columns with expand/collapse functionality
- Persist column collapse state in localStorage
- Useful for focusing on specific workflow stages
- **Subtle/hidden "sort by" option** in each column

### Issue Cards
- Display issue ID prominently on card
- Display issue title
- Display truncated description (max 2 lines) below title - **smaller than title, more so than current**
- Show full description on hover or in detail panel
- Click card to open inline detail panel for editing
- Display due dates on cards if set in Beads
- Highlight overdue items in red
- **Show actual issue titles for dependencies** instead of just counts
- Show dependency relationships with linked issue titles
- **Display comprehensive metadata**:
  - `created_at` - creation timestamp
  - `updated_at` - last update timestamp
  - `closed_at` - completion timestamp (for closed issues)
  - `dependency_count` - number of issues this issue blocks
  - `dependent_count` - number of issues blocking this issue
  - `dependencies` - actual issue titles, not just counts
  - `assignee` - assigned user
  - `labels` - issue labels/tags
  - Comment count/indicators
  - Any other relevant Beads metadata from endpoint
- **Adaptive information density** - show more details when screen space allows
- **Card highlighting** - Currently editing card gets highlighted with subtle accent background (not obfuscating blue)
- **Active agent indicator** - Show which agent is working on which ticket:
  - Display as prominent chip design (preserve beautiful original design)
  - Better positioning on card (top right)
  - Only show in "In Progress" column
  - Hidden from "In Progress" and "Blocked" columns where not relevant
- **Issue type badge** - lowkey spot with icon and label in bottom right corner, aligned with beads ID
- **Priority indicator** - vertical colored border line with priority label
- **Priority label design**:
  - Tiny monospace font
  - Colored same as border of bead
  - Written along the colored line with margin
  - Full word (no abbreviation: "priority" not "P1")
  - No glow effect
  - Scaled down appropriately
  - **Show only on hover**
- **Subtle depth with shading** - 0.5px transparent shading line around beads (top white, bottom black), slightly more apparent
- **Subtle distanced shadow** - Behind each bead, not extreme, not clipped
- **Cohesive color scheme** - avoid too diverse colors and styles on chips/badges
- **No delete button in hover state** - removed from card hover
- **No redundant date in hover state** - cleaned up hover UI
- **No hotkey icons in background after resize** - Icons should disappear properly
- **Simplified hotkey UI** - Overlay should not clutter interface with too much information
- **Right-click context menu**:
  - Quickly change priority
  - Quickly change type
  - **Drag-to-link feature** - draggable rope-like element to create relations with other issues
  - **Controls to remove relationships** - Ability to unlink beads
  - Quick actions for common operations
  - **Must respect dark/light mode theme**

### Card Movement Transitions
- **Enhanced visual transition animation when a card moves in real-time**
- **Green glow border effect** on cards that change status
- **Scale bounce animation** to draw attention to moved cards
- **Elevated z-index** during transition to make movement prominent
- Alerts viewers to take notice of real-time changes
- Helps users track updates made by other clients via SSE
- Applied when cards move via real-time status changes
- **Teleport strobe effect** - smooth transport effect with placeholder swap
- **Smooth column switching** - moving bead goes to placeholder position with smooth swap
- **Placeholder pre-transition** - Placeholder should transition from 0 to final size before the teleport starts
- **Placeholder persistence bug fix** - Placeholder should not stay after transport, preventing double transportation to target under empty spot
- **Debug visualization** - Placeholder beads shown as transparent red when debugging (can be toggled/disabled)
- **Target bead height matching** - Placeholder height in teleport animation must match the actual height of the incoming bead

### Edit Functionality (Inline Detail Panel)
- Click card to open inline detail panel
- Panel design:
  - Opens in between columns (not as sidebar)
  - Pushes furthest column out of viewport
  - Panel width scales appropriately on larger screens
  - Smooth CSS transition animations
  - **Border radius must clip corners properly** - no overflow, left border aligned with radius
  - Header shows issue ID with priority color bar, or "New Issue" title
  - **Good contrast for "New Issue" title** against blue background
  - Visual status selector
  - **Fresh, light-colored bottom section** - save/delete area redesigned to fit better
- Edit capabilities: title, description, priority, status, assignee, design, acceptance, notes
- **Cannot edit issue_type** - not supported by bd update command
- **Show all available Beads fields in the panel**:
  - `design` field - design specifications
  - `acceptance` field - acceptance criteria
  - `notes` field - additional notes
  - `assignee` field - assigned user
  - All other editable fields from Beads
- **Comments section** in detail panel:
  - Display existing comments with timestamps and authors
  - Add new comments
  - Full comment thread for the issue
  - Useful for tracking progress, updates, discussion
- **Unsaved changes warning** - warn user if they click away while typing a new issue
- **Warn on close** - When an issue being viewed in the detail pane is closed (by another user, session, or auto-close), warn the user that the item has been closed
- Save changes via PATCH /api/issues/[id]
- Currently editing card gets highlighted on board with subtle accent background (not obfuscating)

### Delete Functionality
- Delete button/option available from inline detail panel
- Confirmation before deletion
- Executes DELETE /api/issues/[id]
- **Removed from hover state** on cards

### Create Issue Functionality
- Add new issue button/interface
- **Positioned on left side or as part of first column (Backlog)** - integrated into board layout
- **Same style as "New Issue"** button in detail panel
- Opens inline detail panel with "New Issue" title
- Form to input: title, description, priority, status, issue_type
- Creates issues via POST /api/issues
- Issues created through web UI should appear immediately in the board
- **Warn if user clicks away** while typing a new issue with unsaved changes
- **First tab should be title field** when opening new issue
- **Hotkey support** - Both new issue and create should have hotkeys communicated visually
- **Spawn new issue model on left side of backlog** - Issue creation interface positioned appropriately

### Search & Filter Functionality
- Search input in header that filters issues by:
  - Title (partial match)
  - Description (partial match)
  - **Issue ID (exact or partial match)** - beads-kanban-XXX searchable
- Filter dropdowns for:
  - Priority: All, P1, P2, P3, P4
  - Type: All, task, bug, feature, epic, chore
- Filters work together (search + priority + type combined)
- Use Svelte 5 `$state` runes for filter state management
- **Visual state for filtered-out items**:
  - Show all tickets even when search is active
  - Non-matching tickets displayed in transparent/disabled state
  - Prevents confusion about "missing" tickets
  - Users can see full context while focusing on matches
- Essential for boards with many issues
- **Fresh form elements** - shading with .5px borders and shadows, not too grey, appropriate sizing
- **Subtle glass effect on dropdowns** - More subtle than previous implementation

### Sorting & Organization
- Sort by due date option within columns
- Default sorting should support due date prioritization
- **Subtle/hidden "sort by" in each column**

### Keyboard Shortcuts
- **Arrow keys**: Navigate between cards (up/down/left/right)
- **Enter**: Edit selected/focused card
- **Delete/Backspace**: Remove selected card
- **N key**: Create new issue
- **Escape**: Deselect current card
- **Hotkey hints shown contextually** - subtle single letters next to relevant items
- **Most relevant steps under a key** at any time
- **Show hotkeys in context** - visible where relevant, not just in help section
- **New issue and create hotkeys** - Both should have hotkeys communicated visually
- **Simplified hotkey UI** - Overlays should not clutter interface with excessive information
- Improves power user productivity
- Essential for accessibility and power users
- **Full keyboard navigation support** - go all in on keyboard navigation with frontend design skill

### Dependency Management
- Prevent moving blocked issues to closed status
- Display blocked-by indicators on cards
- Show dependency_count and dependent_count on cards
- **Show actual issue titles for dependencies** instead of just counts
- Visual dependency lines between cards (nice-to-have)
- **Link with other issues at a glance** - make dependencies clearly visible
- **Drag-to-link from context menu** - create relationships by dragging rope-like element to another bead
- **Controls to remove relationships** - Ability to unlink beads from each other

### Live Updates
- Real-time synchronization using Server-Sent Events (SSE)
- Ensures all connected clients see issue changes immediately
- Eliminates need for polling mechanism
- Changes made by other clients or external Beads CLI should appear in real-time

### Description Population
- Ensure all issue descriptions are properly populated and displayed
- Descriptions should be fetched from Beads and shown in the UI

### Dark Mode & Theme Switching
- **Night/day theme toggle** in header
- Store theme preference in localStorage
- Use CSS custom properties for easy theming
- Support both light and dark color schemes
- Toggle control should be intuitive and accessible
- **All UI components must respect theme** - including chat bar, panels, cards, context menus, etc.
- **Subtle glass effect on theme toggle** - More subtle than previous implementation
- **Dark mode background should not be too dark** - Lighter than initially implemented

### Mobile Responsive Layout
- **Media queries**: Mobile breakpoint at 768px
- **Vertical stacking**: Columns stack vertically on mobile devices
- **Touch targets**: Minimum 44px touch targets for mobile interaction (CRITICAL)
- **Column navigation**: Navigation dots for switching between columns on mobile
- **Swipe gestures**: Swipe left/right to navigate between columns (needs improvement)
- **Panel dismissal gestures**: Swipe or gesture to dismiss panels on mobile
- Mobile-first responsive design approach
- Ensure usability on touch devices
- **Consistent alignment, shapes, and heights** - All mobile elements must be properly aligned
- **Native-feeling mobile experience** - Polish without changing what works well

### Extended Issue Metadata Display
- Load and display all available issue data from Beads CLI
- Include all timestamps: created_at, updated_at, closed_at
- Show dependency metrics: dependency_count, dependent_count
- **Show actual dependency issue titles** instead of just counts
- Display assignee and labels on cards
- Show comment counts and access to comments
- Display time-related metadata on cards
- **Display all available Beads fields**: design, acceptance, notes
- Display any other metadata available from `bd list --json`
- Ensure complete issue information is accessible in the UI
- Fetch and integrate all available data from the endpoint

### Deep Linking
- **URL routes for direct issue access**: `/issue/[id]` or hash/query params (`?issue=beads-kanban-xyz`)
- **Auto-open detail panel** when URL contains issue ID
- **Update URL** when opening/closing issue panels
- **Browser navigation support** - back/forward buttons work correctly
- Enable sharing of specific issue views

### Animation & Polish
- **Micro-animations throughout the interface**:
  - Card hover states
  - Button interactions
  - Panel transitions
  - Status changes
  - Drag and drop feedback
  - Loading states
- **Character in hover animations** - Use animation skill to add personality
- **Attention to detail** - Interface should feel loved and carefully crafted
- **Smooth, delightful interactions** at every touchpoint
- Premium feel comparable to top-tier applications

### Comments System
- **View comments** on any issue via detail panel
- **Add new comments** to issues
- Display comments with timestamps and authors
- Comments useful for:
  - Progress tracking
  - Updates and communication
  - Understanding context (especially for reopened issues)
- Integration with `bd comments` CLI commands
- **Fetch comments when needed** - Use `bd comments <issue-id>` to retrieve feedback mentioned in tickets

### Empty State Handling
- **"No issues" placeholders** in empty columns
- **Placeholders should not be affected by drag and drop** - Should remain static during drag interactions

### Attachments System
- **Attach files to issues** - documents, images, screenshots, etc.
- Store attachments with the issue
- Retrieve attachments through issue detail pane
- Support various file types
- Display attachment indicators on cards
- Full attachment management in detail panel

### Beads Initialization
- **Initialize Beads in current directory** via UI or command
- Support custom prefix parameter (e.g., "myproject" creates issues like myproject-1, myproject-2)
- Default prefix is current directory name if not provided
- Use Beads MCP `init` tool with prefix parameter
- After initialization:
  - Show database location
  - Show issue prefix that will be used
  - Explain basic workflow