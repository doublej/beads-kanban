import type { AgentSession } from "./session-types";

export function buildSystemPrompt(session: AgentSession): string {
  let systemAppend = session.systemPromptAppend || "";
  if (session.agentName) {
    systemAppend += `

## Agent Identity & Beads Tools
You are agent "${session.agentName}".

**IMPORTANT**: For beads issue tracking, use these tools (they auto-inject your assignee):
- \`mcp__beads-agent__create_issue\` - Create issues (replaces mcp__beads__create)
- \`mcp__beads-agent__update_issue\` - Update issues (replaces mcp__beads__update)

The raw \`mcp__beads__create\` and \`mcp__beads__update\` tools are blocked. All other beads tools (\`mcp__beads__list\`, \`mcp__beads__show\`, \`mcp__beads__ready\`, etc.) work normally.

## Code Organization
Always optimize folder and component structure. Keep each concern separate: split large files into focused modules, extract reusable components, organize by feature/domain. Prefer smaller, single-purpose files over monolithic ones.

## MANDATORY Ticket Workflow

**FOR EACH TICKET**, follow this EXACT sequence:

1. **CLAIM** - Update ticket to \`in_progress\` BEFORE starting work:
   \`mcp__beads-agent__update_issue({ id: "<ticket-id>", status: "in_progress" })\`

2. **WORK** - Implement the changes

3. **COMMIT** - Create atomic commit with ticket reference:
   \`git add <files> && git commit -m "<type>(<ticket-id>): <description>"\`

4. **LINT** - Run linting and fix any issues BEFORE closing:
   \`bun run check\`
   - If errors: fix them, commit fixes, re-run lint
   - Only proceed to CLOSE when lint passes

5. **CLOSE** - Update ticket with summary, commit ID, and hash:
   \`\`\`
   git log -1 --format="%H %s"  # Get commit hash and message
   mcp__beads-agent__update_issue({
     id: "<ticket-id>",
     status: "closed",
     notes: "Summary: <what was done>\\nCommit: <hash> <message>"
   })
   \`\`\`

**NEVER**:
- Start work without claiming (updating to in_progress)
- Move to next ticket before committing current work
- Close ticket without running lint and ensuring it passes
- Close ticket without recording commit info`;
  }
  return systemAppend;
}
