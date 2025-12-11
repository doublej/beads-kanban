# Beads-Kanban Project Briefing

**Generated:** 2025-12-11
**Source:** 281 user messages across 61 sessions + 80 beads tickets
**Date Range:** 2025-12-09 to 2025-12-10

---

## Project Overview

Beads-Kanban is a SvelteKit web app providing a Kanban board UI for the [Beads](https://github.com/steveyegge/beads) issue tracker. It wraps the `bd` CLI for drag-and-drop issue management with real-time WebSocket updates.

**Core Value Proposition:** Visual drag-and-drop issue management with real-time agent coordination, teleport animations for status changes, and distinctive Apple-inspired aesthetics.

---

## Tech Stack (Strict Requirements)

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | SvelteKit 2 | SSR enabled |
| Language | TypeScript | Strict mode |
| Reactivity | Svelte 5 runes | `$state`, `$derived`, `$effect` ONLY |
| State | No stores | Runes replace all store patterns |
| Styling | CSS-in-Svelte | CSS variables, `<style>` blocks |
| CLI Integration | `child_process.exec` | Shell out to `bd` commands |
| Real-time | WebSocket (port 8765) | Pane bridge daemon |
| Build | Vite 5 | HMR disabled in config |

---

## Architecture

### Data Flow
```
bd CLI (JSONL) → API routes → fetch → Svelte $state → UI
                    ↑                      ↓
              Server-Sent Events ← WebSocket bridge
```

### Key Files

| File | Purpose |
|------|---------|
| `src/routes/+page.svelte` | Main Kanban board (~2000+ lines, monolith acceptable) |
| `src/routes/+layout.svelte` | Root layout: theme, title, Safari meta tags |
| `src/routes/+layout.server.ts` | Server: provides `cwd`, `folderName` |
| `src/routes/api/issues/+server.ts` | GET/POST: `bd list --json`, `bd create` |
| `src/routes/api/issues/stream/+server.ts` | **SSE endpoint**: polls `bd list` every 2s, enriches dependencies |
| `src/routes/api/issues/[id]/+server.ts` | PATCH/DELETE: `bd update`, `bd close` |
| `src/routes/api/issues/[id]/deps/+server.ts` | Dependency CRUD: `bd dep add/remove` |
| `src/routes/api/issues/[id]/comments/+server.ts` | Comments: `bd comments`, `bd comment` |
| `src/lib/api.ts` | Client fetch wrappers (updateIssue, createIssueApi, etc.) |
| `src/lib/wsStore.svelte.ts` | WebSocket store for agent pane bridge (port 8765) |
| `src/lib/types.ts` | TypeScript interfaces |
| `src/lib/utils.ts` | Kanban helpers (columns config, sorting) |
| `src/routes/about/+page.svelte` | About page |
| `src/routes/prompts/+page.svelte` | AI prompts page |

### Status Flow
```
open → in_progress → blocked → closed
  ↓         ↓            ↓         ↓
Backlog  In Progress  Blocked  Complete
```

### Virtual Columns (Labels)
Draft, Feedback, Review columns are label-based, not status-based. Issues remain `open` but display in separate columns based on labels.

---

## Code Standards (MANDATORY)

### DO
| Requirement | Example |
|-------------|---------|
| Svelte 5 runes | `let count = $state(0)` |
| CSS variables | `var(--text-primary)`, `var(--bg-card)` |
| Edit existing files | Modify `+page.svelte`, don't create components |
| Native HTML5 drag-drop | `draggable="true"`, `ondragstart`, `ondrop` |
| Fail hard on errors | Throw, don't catch for control flow |
| 0.5px borders/shadows | Subtle depth, not heavy |
| `overflow: hidden` on containers | Proper border-radius clipping |

### DON'T
| Forbidden | Reason |
|-----------|--------|
| Svelte stores | Use runes instead |
| Tailwind | Project uses CSS variables |
| Try/catch for control flow | Fail hard |
| Inter, Roboto, Arial | Generic "AI slop" fonts |
| New files | Edit existing unless absolutely essential |
| Polling | Use SSE/WebSocket |
| Vim keybindings | Explicitly rejected |

---

## Design Philosophy (Apple-Inspired)

### Typography
- **Distinctive fonts only**: No Inter, Roboto, Arial, system fonts
- **Hierarchy**: Larger titles (0.875rem), smaller descriptions (0.6875rem)
- **Monospace for metadata**: `ui-monospace, 'SF Mono'` for IDs, priority labels

### Color & Theme
- **CSS variables for theming**: Light/dark mode via `[data-theme]`
- **Dominant colors with sharp accents**: Not timid, evenly-distributed palettes
- **Dark mode**: Background should be light enough to contrast with cards
- **Priority colors**: Along left border, monospace label text matching

### Motion & Animation
- **Teleport effect**: Flying card with ghost trail (5 frames) for column changes
- **Placeholder system**: Invisible item expands to "make room" before teleport
- **Hover animations**: Springy cubic-bezier `(0.34, 1.4, 0.64, 1)` for transform
- **Shadow transitions**: Material Design deceleration `(0, 0, 0.2, 1)`
- **Staggered reveals**: 50-100ms offset for multiple items

### Depth & Atmosphere
- **Card shadows**: Subtle, distant (0.08/0.04 opacity), NOT heavy
- **Aurora background**: Radial gradients, soft colorful tones, lighter at edges
- **Inset shadows**: For 3D depth on cards
- **0.5px borders**: Subtle top/bottom for depth

### Layout
- **Detail pane**: Opens BETWEEN columns, NOT as sidebar
- **New Issue panel**: Spawns on left side of Backlog column
- **Mobile**: Touch targets ≥44px, proper alignment, horizontal scroll for columns

---

## Animation Specifications

### Teleport Effect
```javascript
// Capture position BEFORE DOM update
const fromPos = getCardPosition(id);
// Create placeholder to "make room"
placeholders = [...placeholders, { id, targetColumn, height }];
// Wait 350ms for placeholder animation
setTimeout(() => {
    const toPos = getPlaceholderPosition(id);
    teleports = [...teleports, { id, from: fromPos, to: toPos, startTime: Date.now() }];
    // Cleanup after 800ms
}, 350);
```

### Card Hover
```css
.card {
  transition:
    transform 200ms cubic-bezier(0.34, 1.4, 0.64, 1),
    box-shadow 250ms cubic-bezier(0, 0, 0.2, 1);
}
.card:hover {
  transform: translateY(-3px) scale(1.005);
}
```

### Shadow Values
```css
/* Default - subtle */
box-shadow:
  0 4px 12px -2px rgba(0, 0, 0, 0.08),
  0 2px 6px -1px rgba(0, 0, 0, 0.04),
  inset 0 1px 0 rgba(255, 255, 255, 0.12),
  inset 0 -1px 0 rgba(0, 0, 0, 0.2);
```

---

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑↓←→` | Navigate between cards |
| `Enter` / `o` | Open selected card |
| `Escape` | Close pane/modal |
| `n` / `N` | New issue |
| `x` | Close/complete issue |
| `Delete` | Delete issue |
| `?` | Toggle keyboard help |
| `/` | Focus search |
| `1-4` | Jump to column |
| `Cmd/Ctrl+Enter` | Submit form |

---

## Explicit Rejections (User Corrections)

| Rejected | User Quote | Fix |
|----------|------------|-----|
| Sidebar detail pane | "don't make it into a sidebar again" | Opens between columns |
| Vim keybindings | "dont do vim" | Standard arrow navigation |
| Heavy shadows | "Its too extreme" | Reduce to 0.08/0.04 opacity |
| Agent chip redesign | "NO what did you do to the beautiful active agent chip, revert it now" | Keep original SVG icon style |
| Too dark background | "even lighter, dont make the beads lighter!" | Lighter bg, same card colors |
| Serif logo font | "horrible, lose the serif font" | Clean modern sans-serif |
| Inline hotkey hints | "they dont seem like they should be there" | Remove `<kbd>` from buttons |
| Form elements grey | "too grey, too much contrast, elements too small" | Translucent white backgrounds |
| Scale on hover affecting shadows | N/A | Removed scale, use translateY only |

---

## Positive Feedback (Preserve These)

| Feature | Status |
|---------|--------|
| Flying card teleport animation | Keep |
| Placeholder "makes room" before teleport | Keep |
| Agent chip with SVG icon in card-content | Keep |
| Keyboard navigation system | Keep |
| Aurora gradient background | Keep |
| Energy beam drag-to-link | Keep |
| Per-column sort dropdown | Keep |
| Search filtering with dimmed non-matches | Keep |
| WebSocket pane integration | Keep |

---

## Workflow Instructions

### Continuous Ticket Processing
```
"Watch for tickets, do not ask questions, do not stop"
"Keep grabbing tickets"
"Always keep fetching tickets!"
```

When tickets run out:
1. Set 5-minute timer
2. Check for new tickets
3. Repeat

### Task Completion Protocol
```
BEAD_DONE: [ticket-id] - [brief summary]
```

### Commit Guidelines
- Commit after each completed bead
- No Claude attribution in commit messages
- One logical change per commit

### Skills to Use
- **Frontend design skill**: For any visual/UI work
- **Animation easing skill**: For motion refinement
- **Usability skill**: For mobile layout review

---

## Open Issues (Current Priority)

### P1 - Critical
| ID | Title | Notes |
|----|-------|-------|
| beads-kanban-ins | Chat sessions not kept, every message restarts | WebSocket state management |
| beads-kanban-8d9 | Subtle shadow behind beads (clipped by containers) | Shadow/overflow conflict |

### P2 - High
| ID | Title | Notes |
|----|-------|-------|
| beads-kanban-0c9 | Target bead height mismatch in teleport animation | Placeholder height calculation |
| beads-kanban-g39 | Clean up swimming lanes top with collapsed columns | CSS layout issue |
| beads-kanban-35y | Warn when issue closes while viewing | Poll or WebSocket notification |
| beads-kanban-zjx | Hotkey UI overlapping/too much info | Simplify, no vim |
| beads-kanban-37z | Fix 24+ Svelte accessibility/CSS warnings | aria roles, tabindex, unused CSS |

### P3 - Medium
| ID | Title | Notes |
|----|-------|-------|
| beads-kanban-7rb | New Issue button part of left side/column | Layout integration |
| beads-kanban-41k | Add attachments functionality | Epic - file storage in .beads/ |

---

## TypeScript Interfaces

```typescript
interface Issue {
  id: string;
  title: string;
  description: string;
  design?: string;
  acceptance_criteria?: string;
  notes?: string;
  status: 'open' | 'in_progress' | 'blocked' | 'closed';
  priority: 1 | 2 | 3 | 4;
  issue_type: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
  assignee?: string;
  labels?: string[];
  dependencies?: Dependency[];
  dependents?: Dependency[];
  // UI state (client-only)
  _showDesign?: boolean;
  _showAcceptance?: boolean;
  _showNotes?: boolean;
}

interface Dependency {
  id: string;
  title: string;
  status: string;
  dependency_type: string;
}

interface Column {
  key: string;
  status: Issue['status'];
  filterLabel?: string;      // Show issues with this label
  excludeLabels?: string[];  // Exclude issues with these labels
  label: string;
  icon: string;
  accent: string;
}

type SortBy = 'priority' | 'created' | 'title';
type PaneSize = 'compact' | 'medium' | 'large';
```

---

## API Reference

### Client Functions (`src/lib/api.ts`)
```typescript
updateIssue(id: string, updates: Partial<Issue>): Promise<void>
deleteIssueApi(id: string): Promise<void>
createIssueApi(form: { title, description, priority, issue_type }): Promise<void>
loadComments(issueId: string): Promise<Comment[]>
addCommentApi(issueId: string, text: string): Promise<void>
createDependencyApi(fromId: string, toId: string, depType?): Promise<Result>
removeDependencyApi(issueId: string, dependsOnId: string): Promise<Result>
```

### SSE Stream (`/api/issues/stream`)
- Polls `bd list --json` every 2 seconds
- Enriches issues with dependency details via `bd show ID --json`
- Returns `data: {"issues": [...]}` events

---

## Beads CLI Reference

```bash
bd list --json              # Fetch all issues
bd show ID --json           # Get single issue with dependencies
bd create "title"           # Create issue
bd update ID --status X     # Update status
bd update ID --title "X"    # Update title
bd close ID                 # Close issue
bd dep add ID1 ID2          # Add dependency
bd dep remove ID1 ID2       # Remove dependency
bd comments ID --json       # List comments as JSON
bd comment ID "text"        # Add comment
```

---

## Configuration

### App Identity
- **Name:** Strandkanban (renamed from beads-kanban)
- **Title format:** `Strandkanban - cwd: {folderName}`
- **Logo:** Clean modern sans-serif, no serif fonts

### Layout (`+layout.svelte`)
```svelte
<svelte:head>
  <title>Strandkanban - cwd: {data.folderName}</title>
  <meta name="theme-color" content={themeColor} />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
</svelte:head>
```

Theme color derived from `isDarkMode`:
- Dark: `#3f3f46`
- Light: `#f5f5f5`

### Vite (`vite.config.ts`)
- HMR disabled
- `server.allowedHosts` includes `m2.local` for network access
- Host: `0.0.0.0` for external connections
- Dev command: `npm run dev` (includes `--host`)

### Theme Variables
```css
:root[data-theme="dark"] {
  --bg-primary: /* lighter than before, user feedback */;
  --bg-card: /* unchanged */;
  --text-primary: #fff;
}
```

---

## Golden Rules

> "dont change a good thing but polish it"

> "THINK! WHAT WOULD APPLE DO?!"

> "use design skill when working on this task"

> "Watch for tickets, do not ask questions, do not stop"

> "Fail hard on errors - TRY CATCH IS FORBIDDEN!"

---

## Implementation Notes

### Shadow Clipping Solution
Cards need `overflow: visible` for shadows, but columns need `overflow: auto` for scroll. Solution: Add padding (2rem) to `.cards` container for shadow breathing room.

### Position Capture Timing
For teleport animation, capture placeholder position BEFORE updating issues array (which removes placeholders from DOM).

### Window Blur Handler
Reset `showHotkeys` state on window blur to prevent stuck hotkey hints.

### Flying Cards Map
```typescript
let flyingCards = $state<Map<string, FlyingCardState>>(new Map());
```

### Placeholder Deduplication
Check for existing placeholders before adding to prevent duplicates:
```typescript
const existingIds = new Set(placeholders.map(p => p.id));
if (!existingIds.has(id)) { ... }
```
