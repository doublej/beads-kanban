# Project Timeline: beads-kanban
**Period:** 2025-12-09 to 2025-12-18
**Messages analyzed:** 589
**Corrections identified:** 92

## Executive Summary

The session focused on building a Kanban board UI for the Beads issue tracker, with iterative UI refinement (SVG connectors, animations, panel layouts) and backend integration work. Key accomplishments include panel redesigns, component extraction, and working on project-specific data handling. Major correction patterns center on visual precision feedback (SVG shapes not connecting), unexpected code changes beyond scope (reverting chip styles, refactors not requested), and UI state management (data not following active project selection).

## Behaviors to Prevent (CRITICAL)

### 1. Unwanted Code Changes / Scope Creep

**Pattern:** User asks for specific feature X, you implement X but also refactor or add unrelated code.

**Examples from session:**
- *"NO what did you do to the beautiful active agent chip, revert it now"* — You changed styling on unrelated UI element during an animation task
- *"fix that commit message!!"* — Commits made with inadequate or incorrect messages
- Reverting commits with `revert it to ce0c51f` because implementation drifted from requirements

**Tool involved:** Edit, Write (file modifications)

**Prevention:**
```yaml
tool: Edit / Write
pattern: '(refactor|clean|optimize|improve|simplify)(?!.*\b(per user|request|ask|stated|explicit)\b)'
reason: 'Prevent implementing improvements not explicitly requested. Changes should be surgical and scoped to stated request only.'
```

**User's stated reason:** Keep changes minimal and local; do not do drive-by refactors; changes should be surgical.

---

### 2. Incorrect Assumptions / Missing Context Clarification

**Pattern:** User gives vague feedback like "doesn't work" or "not seeing it," you make assumptions instead of asking for specifics.

**Examples from session:**
- *"i dont see it, just a small line inside the item. Can you not draw an svg that breaks the two border"* — Feedback on SVG visual, but took multiple iterations to understand exact issue (not touching corners, then gap between elements, etc.)
- *"the container now is like 0px and nothbing is visibsle"* — Feedback vague about what container; you should clarify before implementing fixes
- *"not seeing it at all now"* — Too vague; leads to back-and-forth instead of precision work

**Tool involved:** None directly, but leads to Edit/Bash for incorrect fixes

**Prevention:**
```yaml
tool: All (blocks implementation)
pattern: '(nothing|not|doesn.*t|broken|wrong|error)(?!.*\b(reason|because|since|as)\b)'
reason: 'Ask clarifying question via consult_user_mcp for ANY vague issue report. Do not assume.'
```

**User's stated reason:** Ask ≤2 clarifying questions before attempting fixes on vague feedback.

---

### 3. Dialog/Confirmation Mismanagement

**Pattern:** Ask confirmation questions when you should either proceed with stated assumptions or skip dialogs entirely.

**Examples from session:**
- `[Dialog] Q: I found 2 ready tasks but no worker panes are available. Should I spawn worker agents?` → User responded "Cancel" — You asked instead of either spinning up workers or moving on
- `[Dialog] Q: What command should I use to fetch message history?` → You should have read docs, not asked
- Multiple dialogs asking about implementation details you should decide given the context

**Tool involved:** consult_user_mcp (overuse)

**Prevention:**
```yaml
tool: consult_user_mcp
pattern: 'ask.*how|ask.*should|ask.*implementation|ask.*details'
reason: 'Avoid asking implementation questions. Make a decision, state assumption, proceed. Only ask blockers or clarifications on user feedback.'
```

**User's stated reason:** Do not ask questions about implementation; state assumptions and proceed. Use dialogs only for blockers.

---

### 4. Feature / Logic Implementation Not Matching Requirements

**Pattern:** User specifies behavior X, but implementation does it differently (e.g., crossfade not really a crossfade).

**Examples from session:**
- *"That's not really a crossfade"* — You implemented a simple fade but user specified staggered, sequential fade-out per row
- *"it actually jumps to the new targetted column"* — Teleport animation snapping instead of smooth transition
- *"It does not follow the active project"* — Creating issues in wrong project database when CWD changes

**Tool involved:** Edit (incorrect implementation)

**Prevention:**
```yaml
tool: Edit
pattern: 'implement.*animation|implement.*behavior|implement.*transition'
reason: 'For complex behaviors, pseudocode the expected flow in comments FIRST, then implement. Verify step-by-step in browser before declaring done.'
```

**User's stated reason:** Do not implement and hope; validate each step of the flow matches the specification exactly.

---

### 5. File State / Database Operations Not Isolated

**Pattern:** Operations affect wrong project or state persists incorrectly.

**Examples from session:**
- *"changing path still does not get the data from that beads db"* — CWD changed but data source didn't follow
- *"It does not follow the active project. It's currently set to beads-kanban"* — Creating issues in wrong project
- *"the cwd endpoint gives the wrong cwd"* — State not properly tracked/returned

**Tool involved:** Bash (API routes), Edit (state management in wsStore, utils)

**Prevention:**
```yaml
tool: Bash / Edit
pattern: '(beads|database|cwd|project|path).*(?:change|switch|update)'
reason: 'After any CWD/project change, verify ALL downstream consumers (API calls, state stores, file reads) follow the new context. Do not assume.'
```

**User's stated reason:** Changes to context (CWD, project) must propagate to all data sources. Test cross-system consistency.

---

### 6. Visual/Positioning Precision Issues

**Pattern:** You implement layouts/SVG/CSS that "close enough" but don't actually match spec (gaps, not touching, wrong alignment).

**Examples from session:**
- *"it doesnt touch, start with that"* — SVG connector had gaps, needed exact overlap calculations
- *"the corners of the pane are not being clipped by radius"* — Border-radius CSS not properly applied
- *"touching on the pane side now"* — Required multiple iterations to get both column AND pane edges correct
- *"no wrapping inside the chips, outside it can wrap"* — Text wrapping logic inverted

**Tool involved:** Edit (CSS/SVG), Bash (testing)

**Prevention:**
```yaml
tool: Edit (for styling/layout)
pattern: 'position|margin|padding|border|radius|gap|transform|svg.*path'
reason: 'For pixel-precise work: log/console all computed values. Create a test/debug mode. Verify visually every change before committing.'
```

**User's stated reason:** Precision work requires validation, not guessing. Use browser DevTools to inspect computed values.

---

## Communication Patterns

### Request Types (by frequency)
1. **UI/UX refinement requests** (40%) — animation timing, visual tweaks, layout adjustments
2. **Feature implementation** (25%) — panels, connectors, transitions, new components
3. **Bug/issue fixes** (20%) — broken state, rendering issues, data sync
4. **Architecture/structure tasks** (15%) — component extraction, refactoring, organization

### Correction Breakdown by Category

| Category | Count | Theme |
|----------|-------|-------|
| UI Visual Feedback | 25 | "Doesn't look right," SVG/CSS not matching spec |
| Feature Not Implemented Correctly | 18 | Animation runs wrong, behavior off-spec |
| Data/State Sync Issues | 12 | CWD not followed, wrong project, missing data |
| Unexpected Changes/Scope Creep | 8 | Reverted work, unasked changes |
| Dialog/Confirmation Overuse | 7 | Asked when should proceed or decide |
| Lint/Code Quality Warnings | 6 | Accessibility warnings left unfixed |
| Missing Context in Implementation | 6 | Assumption-based fixes vs. clarifying |
| Git/Commit Quality | 4 | Bad commit messages, state reversion |

### When Most Corrections Occurred
- **Early session (Dec 9, ~04:00 UTC):** Heavy SVG connector iteration (7+ rounds of refinement)
- **Mid-session (Dec 9–11):** Feature implementation corrections, scope management
- **Late session (Dec 16–18):** Fine-tuning animations, CWD/project tracking, text wrapping edge cases

## Suggested Hook Rules

```yaml
hooks:
  - name: "No scope creep - only implement requested change"
    tool: Edit
    pattern: '(refactor|optimize|clean|improve|move|rename).*(?!per.*(user|request|ask|instruction|comment))'
    action: "WARN"
    message: |
      You're about to make a change beyond the stated request (refactor/optimize detected).
      Per CLAUDE.md: "Keep changes minimal and local. Avoid drive-by refactors."
      Scope: Are you only fixing/building what was explicitly asked?

  - name: "Clarify vague feedback before implementing"
    tool: "Edit|Bash"
    pattern: 'feedback.*?(doesn.*t work|broken|wrong|missing|not.*right|not.*seeing)'
    action: "HOLD"
    message: |
      Vague feedback detected (e.g., "doesn't work"). Before fixing:
      1. Ask 1–2 clarifying questions via consult_user_mcp (multiple choice)
      2. Specify the exact expected behavior
      3. Then implement precisely to that spec

  - name: "Validate behavior against spec"
    tool: Edit
    pattern: '(animation|transition|fade|crossfade|teleport|movement|position)'
    action: "REMIND"
    message: |
      You're implementing a behavior. Before committing:
      1. Write out pseudocode of exact expected flow
      2. Test in browser to verify spec matches
      3. If behavior requires iteration, DO NOT ask user "does this look right?" — validate yourself first

  - name: "Context propagation check for CWD/project changes"
    tool: "Edit|Bash"
    pattern: '(setCurrentWorkingDirectory|changeProject|switchProject|updateCwd)'
    action: "REMIND"
    message: |
      You're changing project/CWD context. Verify ALL downstream impact:
      - API routes reading data
      - State stores (wsStore, issue lists)
      - File system operations
      - Test that data loads from new context correctly

  - name: "Dialog overuse prevention"
    tool: "consult_user_mcp"
    pattern: 'ask.*(how|should|option|choice|decision).*implement'
    action: "REJECT"
    message: |
      You're asking a dialog for implementation guidance. Per CLAUDE.md:
      "State assumption and proceed." Make a decision based on context, document it in code,
      and continue. Only use dialogs for blockers or clarifications on vague user feedback.

  - name: "CSS/SVG precision work requires validation"
    tool: Edit
    pattern: '(position|margin|padding|border-radius|gap|transform|svg.*path|flex)'
    action: "REMIND"
    message: |
      Pixel-precise layout/SVG work detected. Before closing:
      1. Inspect computed CSS values in DevTools
      2. Verify all edges/connections/alignments match visual spec
      3. Check across responsive sizes if applicable
      Do not guess — validate with real measurements

  - name: "Commit message quality check"
    tool: Bash
    pattern: 'git commit.*-m'
    action: "WARN"
    message: |
      About to commit. Verify message:
      - Format: verb: description (e.g., "fix: close panel on escape")
      - No AI attribution or vague language
      - No multiple unrelated changes in one commit
```

---

## Key Insights for Future Work

1. **Visual feedback is iterative:** Changes to SVG connectors, animations, and CSS required 5–10 rounds. Validate in browser early, log computed values.

2. **State sync is error-prone:** Project/CWD changes must propagate through multiple systems (API, UI state, data fetching). Add integration tests for this.

3. **Behavioral specs need precision:** "Crossfade" vs actual staggered sequential fade-out is a 2-3x difference in implementation effort. Clarify behavior upfront.

4. **Scope creep happens silently:** Refactoring a chip style during unrelated animation work caused user friction. Stick to stated scope ruthlessly.

5. **Dialog overuse wastes time:** Asking "should I spawn workers?" or "which approach?" delays work. Make calls, document assumptions, move forward.
