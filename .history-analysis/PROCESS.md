# Iterative Briefing Extraction Process

**Purpose:** Extract a comprehensive project briefing from Claude Code session history using iterative LLM processing.

---

## The Problem

After working on a project across many Claude Code sessions, valuable knowledge is scattered across hundreds of messages:
- Tech stack decisions
- Design preferences
- User corrections ("no, don't do X")
- Workflow rules
- Feature requirements

This knowledge is trapped in conversation history and gets lost when starting new sessions.

---

## The Solution: Iterative Accumulation

Process history in small chunks, building up a briefing document that grows with each iteration.

**Key insight:** Each LLM call receives:
1. The current briefing (what we know so far)
2. A small batch of new events to process
3. Instructions to output an UPDATED briefing

Each call is a **fresh session** with no memory of previous calls. The briefing document IS the memory.

---

## Process Steps

### 1. Gather Raw Data

Extract all user messages from Claude Code session history into a structured format. Include timestamps and content.

If using an issue tracker (like Beads), export tickets as well.

### 2. Create Chronological Timeline

Merge all data sources into a single timeline sorted by timestamp. Each entry should have:
- Type (message, ticket, etc.)
- Timestamp
- Content/details

Filter out noise:
- Skip ticket "closed" events (redundant)
- Skip very short messages ("hi", "ok")
- Keep only events that contain actual project knowledge

### 3. Chunk the Timeline

Split into batches of ~10 events each. This balances:
- API call count (fewer chunks = fewer calls)
- Context size per call (smaller chunks = faster processing)

### 4. Run Iterative Processing

For each chunk, make an LLM call with this structure:

**Input:**
- Current briefing (empty for first chunk)
- The next batch of events
- Instructions for what to extract

**Instructions should specify:**
- Preserve existing knowledge
- Integrate new facts from events
- Note CORRECTIONS where user changed their mind
- Track REJECTIONS explicitly (what NOT to do)
- Capture END GOALS, not implementation status
- Output only the updated briefing, no explanations

**Output:**
- Updated briefing document

Save progress after each chunk so you can resume if interrupted.

### 5. Final Briefing

After all chunks processed, you have a clean briefing containing:
- Project identity and purpose
- Tech stack and architecture decisions
- Design philosophy and preferences
- Explicit rejections (what NOT to do)
- Positive feedback (what to preserve)
- Workflow and process rules
- Features and their end goals

---

## Why This Works

### No Context Limits
Each iteration only needs the current briefing + one small chunk. Process thousands of events without hitting token limits.

### Cumulative Knowledge
The briefing grows organically, with later events able to correct or override earlier assumptions.

### Clean Output
The LLM acts as a filter, extracting signal from noise. Greetings, status updates, and irrelevant chatter get filtered out.

### Corrections Preserved
When a user says "no, don't do X" or "revert that", this gets captured as an explicit rejection in the briefing.

---

## Key Principles

**New Session Per Chunk**
- No context bleed between iterations
- Deterministic: same input = same output
- The briefing document is the only state

**Focus on End Goals**
- Don't track "this is broken" or "WIP"
- Capture what features SHOULD do when complete
- The briefing describes the target, not current state

**Track Rejections Explicitly**
- User corrections are gold
- "Don't use Tailwind" matters as much as "use CSS variables"
- Negative preferences prevent future mistakes

**Filter Aggressively**
- Not every message contains knowledge
- Ticket closures are redundant
- Only process events with actual content

---

## Adapting to Other Projects

This process works for any project with conversation history:

1. **Find your data sources** - Session logs, chat exports, issue trackers
2. **Normalize to timeline** - Same format, sorted by time
3. **Define your categories** - What knowledge matters for YOUR project?
4. **Tune chunk size** - More events = fewer calls but larger context
5. **Adjust filtering** - What counts as noise in YOUR domain?

The output is a living document that captures everything an agent needs to continue the project without asking questions that were already answered.
