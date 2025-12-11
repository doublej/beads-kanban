# Beads-Kanban Evolving Briefing

*Built incrementally from chronological project history*

---

## Chunk 1/85 (Messages 1-5)

**Events:**
- "hi"
- "I want you to design a kanban board that directly integrates with beads. (use design skill when working on this task). Dont code yourself use agents"
- "ready?"
- "Hi"
- "What is your briefing so far"

**Accumulated Understanding:**

### Project Goal
Build a Kanban board that integrates with Beads issue tracker.

### Workflow Preferences
- Use design skill for UI work
- Don't code directly - spawn agents to do development
- Multi-agent workflow expected

---

## Chunk 2-3 (Messages 6-15)

**Events:**
- Agent tasks dispatched for API endpoints (SvelteKit 5, Svelte 5 runes)
- BEAD_DONE: API endpoints created
- BEAD_DONE: Kanban UI created - 160 lines, 4 columns, drag-drop, 5s polling
- First beads created: user auth, login styling, dark mode, docs

**New Understanding:**

### Tech Stack
- SvelteKit 5
- Svelte 5 with runes (`$state`, `$effect`, not stores)
- API: `bd list --json`, `bd update <id> --status`
- Status values: open, in_progress, blocked, closed

### Architecture
- 4-column Kanban board
- Native drag-drop
- Polling for updates (initially 5s)

---

## Chunk 4-5 (Messages 16-25)

**Events:**
- "i dont see it feeding from real beads data?"
- "I need descriptions, i need edit, i need delete, i need live updates"
- API extended with DELETE, POST, PATCH, SSE streaming
- UI extended with descriptions, edit/delete modals, SSE live updates

**New Understanding:**

### Requirements Clarified
- Must show real beads data
- Need: descriptions, edit, delete, live updates
- SSE preferred over polling

---

## Chunk 6-8 (Messages 26-40)

**Events:**
- "Use beads to manage this project"
- Multiple beads created for features: card counts, search/filter, keyboard shortcuts, dependencies, due dates, mobile responsive, dark mode
- Initial beads closed (auth, login, dark mode, docs)

**New Understanding:**

### Workflow
- Use beads for project management (not markdown TODOs)
- Batch feature planning via tickets

### Planned Features
- Column card counts
- Search/filter
- Keyboard shortcuts
- Issue dependencies
- Mobile responsive
- Dark mode theme

---

## Chunk 9-10 (Messages 41-50)

**Events:**
- "turn vite hmr off"
- "quite some open tickets lets go"
- "I added one through webui, dont see it"
- BEAD_DONE: card counts, search/filter

**New Understanding:**

### Configuration
- Vite HMR should be disabled

### Issue Found
- WebUI additions not syncing to Kanban

---

## Chunk 11-13 (Messages 51-65)

**Events:**
- Svelte accessibility warnings appearing
- "We should show ticket id too"
- "put agents to work" / "GEt beads issues, start agents to work on it"
- BEAD_DONE: transition animation (scale, glow, background pulse)
- BEAD_DONE: keyboard navigation (arrows, Enter, Delete, N, Escape)
- BEAD_DONE: mobile responsive (768px breakpoint)

**New Understanding:**

### UI Requirements
- Show ticket IDs on cards
- Keyboard navigation: arrows move between cards, Enter edits, Delete removes, N creates new, Escape closes

### Animation
- Card transitions: scale, glow, background pulse effects

### Mobile
- Breakpoint at 768px
- Larger touch targets

---

## Chunk 14-15 (Messages 66-75)

**Events:**
- "use design skill" / "frontend design skill"
- "Make this kanbanboard look much more sophisticated, work on drop states, make it SOTA"
- "Add night/day switch, fill the screen with the columns"
- "if there's room show more information per item"
- beads-kanban-hn8 created: "Get more issue data loaded"

**New Understanding:**

### Design Direction
- Use frontend design skill for UI work
- Sophisticated drop states
- State-of-the-art (SOTA) visual design
- Night/day (dark/light) mode switch
- Columns should fill the screen
- Show more information when space allows

---

## Chunk 16-19 (Messages 76-95)

**Events:**
- "Get tickets and distribute to workers"
- "Brief workers" / "Give workers tasks"
- Multiple workers completing tasks
- BEAD_DONE: enhanced transition with green glow border, scale bounce
- BEAD_DONE: added dependency_count, dependent_count, closed_at, created_at display

**New Understanding:**

### Workflow Pattern
- Orchestrator fetches beads tickets
- Distributes to worker agents
- Workers report BEAD_DONE on completion

### Data Display
- Show dependency counts
- Show closed_at timestamp
- Show created_at timestamp

---

## Chunk 20 (Messages 96-100)

**Events:**
- "More details are now available"
- Panel replaced modal: "Slides out inline"
- "(use design skill when working on this task) Implement the new data"

**New Understanding:**

### UI Pattern Change
- Detail view: inline slide-out panel, NOT popup modal

---

## Chunk 21-22 (Messages 101-110)

**Events:**
- "dont make it into a sidebar again, how about it opens in between two columns, pushes the furthest one"
- "Create a connection between the selected ticket and the pane"
- beads-kanban-uif: "Show link with other issues at a glance"
- beads-kanban-6ts: "Add paths for deeplinking to issues"
- "draw an svg that breaks the two borders"

**New Understanding:**

### REJECTION: Sidebar
- Detail pane must NOT be a sidebar
- Opens BETWEEN columns, pushes columns aside

### Visual Connection
- SVG connector between card and detail pane (attempted)

---

## Chunk 23-26 (Messages 111-130)

**Events:**
- Multiple attempts at SVG connector: "not connected", "left lines wrong direction", "doesnt touch"
- "forget about this, remove the connection"
- "you call yourself a manager agent"

**New Understanding:**

### REJECTION: SVG Connection Feature
- Abandoned after multiple failed attempts
- User frustrated with implementation quality

---

## Chunk 27-29 (Messages 131-145)

**Events:**
- beads-kanban-gmp: "Implement websocket feed in kanban UI"
- beads-kanban-4pq: "Copy to clipboard"
- beads-kanban-gpw: "Add UI for websocket feed"
- BEAD_DONE: WebSocket feed with pane activity sidebar
- beads-kanban-s4h: "FEEDBACK When there are too many issues in 1 column they start crowding"
- "corners of the pane are not being clipped by radius"

**New Understanding:**

### WebSocket Integration
- WebSocket bridge at ws://localhost:8765
- Pane activity sidebar showing live status

### UI Issues
- Column overflow when too many issues
- Border-radius clipping problems on edit pane

---

## Chunk 30-33 (Messages 146-165)

**Events:**
- Multiple debugging of WebSocket connection
- Unix socket vs WebSocket confusion
- "im lost as to if its doing anything"
- "you tell me, i know nothing"

**New Understanding:**

### WebSocket Setup
- Daemon uses Unix socket: /tmp/claude-agent-viewer.sock
- Bridge exposes ws://localhost:8765
- Response format: `{"type": "response", "data": {...}}`

---

## Chunk 34-35 (Messages 166-175)

**Events:**
- "Amazing. Treat the panes like chats. Show more history and i'd like to pin them in small form to bottom"
- "allow to make the windows larger"
- "Allow to resize and move"
- beads-kanban-6ye: "The chatbar at the bottom should not always be black"

**New Understanding:**

### POSITIVE: Pane Chat UI
- User loves the chat-like pane interface
- Should show message history
- Pinnable to bottom in small form
- Resizable and movable

### Theme Issue
- Chat bar should respect dark/light mode, not always black

---

## Chunk 36-38 (Messages 176-190)

**Events:**
- "Pick anything frontend related from the beads issue list. Dont ask me questions."
- Many beads closed rapidly (4pq, 6ye, 265, 6rm, 6ts, 7fd, gmp, yta, u41, ixo, cob)
- beads-kanban-don: "Chat bar overlapping the UI"

**New Understanding:**

### Workflow Directive
- Don't ask questions, just work
- Pick frontend issues autonomously
- Rapid ticket completion expected

---

## Chunk 39-41 (Messages 191-205)

**Events:**
- beads-kanban-6xk: "The UI is too boring with these border radius 2005 gradient elements"
- beads-kanban-say: "Add more animations, tiny micro UI animations"
- beads-kanban-4yl: "Search state"
- beads-kanban-m1h: "patch endpoint still not working"

**New Understanding:**

### REJECTION: 2005 Gradient Aesthetics
- Border radius + gradients feel dated
- Need more sophisticated, modern design

### Animation
- Add micro-interactions
- "Like someone really loved working on it"

---

## Chunk 42-44 (Messages 206-220)

**Events:**
- beads-kanban-ml2: "Rename the kanban interface"
- beads-kanban-hmw: "Compose pane: I dont like the bottom section where save and delete sit"
- beads-kanban-8hu: "Context menu features"
- beads-kanban-wk1: "Context menu does not respect dark/light mode"
- beads-kanban-9sb: "Active agent on ticket can be more prominent"
- "if they reopened, that must have a reason"

**New Understanding:**

### UI Feedback
- Compose pane bottom section needs redesign
- Context menu should follow theme
- Active agent indicator needs more prominence

### Workflow Note
- If tickets reopen, investigate why

---

## Chunk 45-47 (Messages 221-235)

**Events:**
- "run lint first"
- "the container now is like 0px and nothing is visible"
- beads-kanban-624: "Drag to link spawns a blue dot but does nothing else"
- beads-kanban-0ob: "Drag to link style looks bad"
- "Keep grabbing tickets"
- "disable vite HMR"
- "dont touch the server, just work on tickets, go"

**New Understanding:**

### Development Rules
- Run lint before commits
- Don't touch the server unnecessarily
- HMR should be disabled
- Keep working on tickets continuously

### Drag-to-Link
- Feature implemented but needs refinement

---

## Chunk 48-50 (Messages 236-250)

**Events:**
- beads-kanban-8kn: "Shadow layer of beads clipped by container"
- beads-kanban-nrl: "Active agent chip hidden from in_progress and blocked"
- beads-kanban-n7i: "Blue state of active beads too obfuscating"
- beads-kanban-z0y: "If typing new issue and click away, should warn"
- beads-kanban-nwd: "Remove delete and redundant date in hover state"
- beads-kanban-t8z: "priority design and label"
- "Keep grabbing tickets"

**New Understanding:**

### Card Design Feedback
- Shadow clipping issues
- Active state (blue) is too strong/obfuscating
- Remove redundant elements from hover state
- Warn before losing unsaved new issue

### Priority Label Design
- Needs specific styling (monospace, colored)

---

## Chunk 51-53 (Messages 251-265)

**Events:**
- beads-kanban-7wg: "Align type icon with beads id, too far into corner"
- beads-kanban-12t: "priority label should be scaled down"
- beads-kanban-tyx: "add label back to type definition, bottom right corner"
- beads-kanban-5ao: "Go all in on keyboard navigation"
- beads-kanban-px2: "Remove the white bg from top bar"
- **"NO what did you do to the beautiful active agent chip, revert it now"**
- "commit and continue"

**New Understanding:**

### REJECTION: Agent Chip Change
- Active agent chip was changed and user demanded revert
- Original design was "beautiful" - don't change it

### Card Layout
- Type icon: align with bead ID
- Priority label: scale down, along colored line
- Label: bottom right corner

### Commit Pattern
- Commit after changes, then continue

---

## Chunk 54-56 (Messages 266-280)

**Events:**
- beads-kanban-e1d: "Lose the border under top bar"
- beads-kanban-30d: "Make the background dynamic with soft colorful tones"
- beads-kanban-0gc: "Beads switching column transition"
- "Always keep fetching tickets!"
- beads-kanban-cao: "Upgrade form elements in top bar - too grey, too much contrast, elements too small"
- beads-kanban-74i: "When opening new issue, first tab should be title"
- beads-kanban-ht1: "Show hotkey hints in context"

**New Understanding:**

### Design Refinements
- Remove border under top bar
- Dynamic colorful background (soft tones)
- Form elements: less grey, less contrast, larger
- New issue form: focus title first

### Workflow
- "Always keep fetching tickets!" - continuous operation

---

## Chunk 57-60 (Messages 281-300)

**Events:**
- "Did you remove the teleport strobe again?"
- "can you give me console command to activate it always? so i can test"
- beads-kanban-mh9: "Give beads subtle depth. Feedback: slightly more apparent"
- beads-kanban-lc8: "Change dropdowns, questionmark, nightmode - glass doesn't look good on small icons"
- beads-kanban-c5f: "Rebalance title and description - description should be smaller"

**New Understanding:**

### Teleport Animation
- Has "strobe" effect that keeps getting removed
- User wants it preserved

### Depth & Styling
- Beads need subtle depth (0.5px transparent shading)
- Small icons: glass effect doesn't work, make subtle
- Description smaller than title

---

## Chunk 61-63 (Messages 301-315)

**Events:**
- beads-kanban-ggk: "Beads zoom effect should not affect the shading"
- beads-kanban-8d9: "Add subtle quite distanced shadow behind each bead"
- beads-kanban-m9x: "Hotkeys for new issue and create"
- beads-kanban-ejn: "Create issue should have same style as New Issue"
- beads-kanban-ffi: "Bead transition placeholder should transition from 0 to final size before teleport"
- beads-kanban-a1c: "Rename the tool to Strand Kanban"
- **"Watch for tickets, do not ask questions, do not stop"**

**New Understanding:**

### Animation Details
- Zoom effect shouldn't affect shading
- Placeholder animates 0 → full size BEFORE teleport starts

### Naming
- Renamed to "Strand Kanban" (from beads-kanban)

### Workflow Directive (Strong)
- Watch for tickets
- Do not ask questions
- Do not stop

---

## Chunk 64-65 (Messages 316-325)

**Events:**
- beads-kanban-2v8: "Show placeholder bead as transparent red" (debugging)
- beads-kanban-kj8: "Need controls to remove relationships between beads"
- beads-kanban-spr: "Logo needs to be white or faint tint, needs light shading and depth"
- beads-kanban-9m9: "After resizing bead, hotkey icons show up in background"

**New Understanding:**

### Logo Design
- White or faint tint
- Light shading and depth

### Debug Features
- Placeholder visible as transparent red (for debugging)

### Bug
- Hotkey icons appearing incorrectly after resize

---

## Chunk 66-68 (Messages 326-340)

**Events:**
- beads-kanban-p9x: "Disable debug state (red reservation bead)"
- beads-kanban-kwr: "No issues placeholders should not be affected by drag n drop"
- beads-kanban-vud: "Add informational pages - About, Prompts"
- beads-kanban-x3d: "Use animation skill for hover animations"
- beads-kanban-3mv: "Try another font for the logo"
- beads-kanban-zat: "Theres a lot of banding in the color gradient overlay"
- beads-kanban-xn4: "Reorganize repo, fix monolith files"
- "commit and push"

**New Understanding:**

### Pages Added
- About page (explaining difference from Vibekanban)
- Prompts page

### Design Issues
- Color gradient banding - needs smooth gradients
- Empty state placeholders shouldn't respond to drag

### Skills to Use
- Animation skill for hover character

---

## Chunk 69-71 (Messages 341-355)

**Events:**
- "pages dont show on board"
- "how do i run this on another project? I need a system-wide command"
- Shell alias approach chosen
- beads-kanban-ea5: "Display the active folder in title"
- "Pick up all incoming beads. Commit after each bead"
- "if there arent any beads loop: pause 1 minute, check for beads"
- beads-kanban-na7: "Improve macOS Safari compatibility"
- beads-kanban-klo: "All text in top bar must align"

**New Understanding:**

### Multi-Project Support
- Launched via shell alias with project path
- Title shows current folder: "Strandkanban - cwd: {folder}"

### Workflow Loop
- If no beads: pause 1 minute → check → repeat
- Commit after each bead completion

### Safari
- Theme-color meta tags for Safari toolbar

---

## Chunk 72-74 (Messages 356-370)

**Events:**
- beads-kanban-vqr: "Dark mode background is too dark"
- "dont see difference in bg"
- "im talking about the page, not the webkit header"
- "make it even lighter"
- **"even lighter, dont make the beads lighter!"**
- "when browser is set to light mode, we must send different colors in meta tags"

**New Understanding:**

### REJECTION: Too Dark Background
- Dark mode background was too dark
- Make it LIGHTER
- But keep beads/cards the same darkness
- Meta theme-color must differ for light/dark mode

---

## Chunk 75-77 (Messages 371-385)

**Events:**
- "Can you extend to more categories?" (link to beads repo)
- "Backlog, in progress, done etc"
- "Draft, Feedback, Review" - custom columns wanted
- "Is a font icon mandatory?"
- "Beads is still giving me invalid status on new status items"
- "Perhaps we add a hidden label? Backlog + Draft label is visually the status"
- "draft/feedback/review as full columns, map to open status in beads"
- beads-kanban-37z: "Fix Svelte Warnings"
- beads-kanban-zjx: "Improve card hotkey UI"
- beads-kanban-41k: "Add attachments functionality"

**New Understanding:**

### Virtual Columns (Label-Based)
- Beads only supports: open, in_progress, blocked, closed
- Custom columns (Draft, Feedback, Review) are LABEL-BASED
- Issue stays "open" status but has label like "draft"
- UI shows as separate column

### Accessibility
- Fix Svelte accessibility warnings

---

## Chunk 78-79 (Messages 386-395)

**Events:**
- beads-kanban-35y: "Warn when issue closes while viewing"
- beads-kanban-369: "Test virtual columns" (closed)
- "No, work on the tickets, just not the tasks"
- "Dont start working, i only want you to clarify them more for future claude"
- beads-kanban-g39: "Clean up swimming lanes top with collapsed columns"
- "Refactor agent usage to use kanban-claude (sibling folder)"
- Vite blocked m2.local - need to add to allowedHosts

**New Understanding:**

### Ticket Clarification Mode
- Sometimes user wants tickets CLARIFIED, not worked on
- "for future claude" - prepare tickets for future sessions

### Vite Config
- Add m2.local to server.allowedHosts for network access

---

## Chunk 80-81 (Messages 396-405)

**Events:**
- "Use usability skill to review mobile layout"
- Touch targets identified as critical
- "Now frontend design skill optimize mobile"
- **"dont change a good thing but polish it"**
- "Focus on the chat pane, it needs to feel so good like its native"
- "also allow external connections"

**New Understanding:**

### GOLDEN RULE: Polish, Don't Redesign
- "dont change a good thing but polish it"
- Preserve what works, refine edges

### Mobile
- Touch targets critical
- Swipe gestures needed
- Panel dismissal gestures

### Chat Pane
- Should feel "native"

---

## Chunk 82-83 (Messages 406-415)

**Events:**
- Multiple agent spawns: "You are an agent named X"
- "chat pane doesnt look great yet. Weird dragger in corner"
- "Optimize mobile, nothing is aligned or has the same shape or height"
- beads-kanban-ins: "Chat sessions not kept, every message is restart"
- "lots of issues"

**New Understanding:**

### Agent System
- Agents spawned with names via WebSocket
- Chat sessions should persist (current bug)

### Mobile Issues
- Alignment problems
- Inconsistent shapes/heights

---

## Chunk 84-85 (Messages 416-424) - FINAL

**Events:**
- beads-kanban-0c9: "Height of target bead in teleport animation doesn't match"
- "use sessions history skill to extract user preferences"
- "im not talking about talking style, i want to see what kinds of corrections i ask for"
- "use session analyzer to get all the user's messages, use beads to get all tickets"
- Current session: building this briefing

**New Understanding:**

### Meta: This Session
- User wants comprehensive briefing from all history
- Extracting patterns of corrections to prevent future mistakes
- Accumulating understanding chronologically

---

# CONSOLIDATED BRIEFING

## Project Identity
- **Name:** Strandkanban (renamed from beads-kanban)
- **Purpose:** Kanban board UI for Beads issue tracker
- **Tech:** SvelteKit 2, Svelte 5 runes, TypeScript, WebSocket

## Core Architecture
- 4 columns: Backlog, In Progress, Blocked, Complete
- Virtual columns via labels: Draft, Feedback, Review
- SSE streaming for live updates
- WebSocket for agent pane bridge (port 8765)
- bd CLI for all issue operations

## Design Philosophy
- Apple-inspired aesthetics
- Distinctive fonts (NO Inter, Roboto, Arial)
- Subtle depth (0.5px borders, distant shadows)
- Dynamic colorful background (aurora gradients)
- Smooth animations with teleport effect

## Explicit Rejections
1. Sidebar detail pane → Opens BETWEEN columns
2. Vim keybindings → Standard arrow navigation
3. Heavy shadows → Subtle 0.08/0.04 opacity
4. Agent chip redesign → Keep original
5. Too dark background → Lighter, beads stay same
6. Gradient banding → Smooth gradients
7. 2005-style gradients → Modern sophisticated
8. SVG connection feature → Abandoned

## Workflow Rules
1. Use design skill for frontend work
2. Don't ask questions, just work
3. Watch for tickets continuously
4. Commit after each bead
5. "dont change a good thing but polish it"
6. If no tickets: loop every 1-5 minutes

## Task Completion
```
BEAD_DONE: [ticket-id] - [brief summary]
```

## Open Issues (Priority)
- P1: beads-kanban-ins (chat sessions), beads-kanban-8d9 (shadow clipping)
- P2: 0c9 (teleport height), g39 (lanes), 35y (warn close), zjx (hotkey UI), 37z (warnings)
- P3: 7rb (new issue button), 41k (attachments)
