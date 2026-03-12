/**
 * Custom beads tools that auto-inject agent name as assignee.
 * These wrap the bd CLI and enforce agent identification.
 */
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { runBd } from "./bd-runner";

// Beads MCP tools to block (we replace these with our wrappers)
export const BLOCKED_BEADS_TOOLS = [
  "mcp__beads__update",
  "mcp__beads__create",
];

export function createBeadsToolsServer(agentName: string, cwd: string) {
  return createSdkMcpServer({
    name: "beads-agent",
    version: "1.0.0",
    tools: [
      tool(
        "update_issue",
        "Update a beads issue. Automatically sets assignee to this agent when claiming work (status=in_progress), unless explicitly overridden.",
        {
          issue_id: z.string().describe("Issue ID (e.g., bd-1)"),
          status: z.enum(["open", "in_progress", "hooked", "blocked", "closed"]).optional(),
          priority: z.number().min(0).max(4).optional(),
          title: z.string().optional(),
          description: z.string().optional(),
          design: z.string().optional(),
          acceptance_criteria: z.string().optional(),
          notes: z.string().optional(),
          external_ref: z.string().optional(),
          assignee: z.string().optional().describe("Override assignee (defaults to agent name when claiming work)"),
        },
        async (args) => {
          const bdArgs = ["update", args.issue_id];

          if (args.status) bdArgs.push("--status", args.status);
          if (args.priority !== undefined) bdArgs.push("--priority", String(args.priority));
          if (args.title) bdArgs.push("--title", args.title);
          if (args.description) bdArgs.push("--description", args.description);
          if (args.design) bdArgs.push("--design", args.design);
          if (args.acceptance_criteria) bdArgs.push("--acceptance", args.acceptance_criteria);
          if (args.notes) bdArgs.push("--notes", args.notes);
          if (args.external_ref) bdArgs.push("--external-ref", args.external_ref);

          // Use explicit assignee if provided, else auto-inject when claiming work
          if (args.assignee) {
            bdArgs.push("--assignee", args.assignee);
          } else if (args.status === "in_progress") {
            bdArgs.push("--assignee", agentName);
          }

          try {
            const result = await runBd(cwd, bdArgs);
            return { content: [{ type: "text" as const, text: result || "Issue updated" }] };
          } catch (err) {
            return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
          }
        }
      ),

      tool(
        "create_issue",
        "Create a new beads issue. Automatically sets assignee to this agent, unless explicitly overridden.",
        {
          title: z.string().describe("Issue title"),
          description: z.string().default(""),
          design: z.string().optional(),
          acceptance: z.string().optional(),
          external_ref: z.string().optional(),
          priority: z.number().min(0).max(4).default(2),
          issue_type: z.enum(["bug", "feature", "task", "epic", "chore"]).default("task"),
          labels: z.array(z.string()).optional(),
          id: z.string().optional().describe("Explicit issue ID"),
          deps: z.array(z.string()).optional().describe("Dependencies"),
          assignee: z.string().optional().describe("Override assignee (defaults to agent name)"),
        },
        async (args) => {
          const bdArgs = ["create", "--title", args.title];

          if (args.description) bdArgs.push("--description", args.description);
          if (args.design) bdArgs.push("--design", args.design);
          if (args.acceptance) bdArgs.push("--acceptance", args.acceptance);
          if (args.external_ref) bdArgs.push("--external-ref", args.external_ref);
          if (args.priority !== undefined) bdArgs.push("--priority", String(args.priority));
          if (args.issue_type) bdArgs.push("--type", args.issue_type);
          if (args.id) bdArgs.push("--id", args.id);
          if (args.labels?.length) bdArgs.push("--labels", args.labels.join(","));
          if (args.deps?.length) {
            for (const dep of args.deps) {
              bdArgs.push("--dep", dep);
            }
          }

          // Use explicit assignee if provided, else auto-inject agent name
          bdArgs.push("--assignee", args.assignee || agentName);

          try {
            const result = await runBd(cwd, bdArgs);
            return { content: [{ type: "text" as const, text: result || "Issue created" }] };
          } catch (err) {
            return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
          }
        }
      ),
    ],
  });
}
