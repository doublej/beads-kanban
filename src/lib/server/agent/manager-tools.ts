/**
 * MCP tools for the manager agent.
 * Direct access to board state, queue, and agent sessions.
 */
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { runBd } from "./bd-runner";
import type { AgentSession } from "./session-types";
import type { AgentQueue } from "./queue-manager";

export function createManagerToolsServer(
	cwd: string,
	sessions: Map<string, AgentSession>,
	queue: AgentQueue,
) {
	return createSdkMcpServer({
		name: "beads-manager",
		version: "1.0.0",
		tools: [
			// --- Board tools ---
			tool(
				"list_issues",
				"List all issues with status, priority, assignee, and dependencies.",
				{},
				async () => {
					try {
						const result = await runBd(cwd, ["list", "--json"]);
						return { content: [{ type: "text" as const, text: result || "No issues found" }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"get_issue",
				"Get detailed information about a single issue.",
				{ id: z.string().describe("Issue ID") },
				async ({ id }) => {
					try {
						const result = await runBd(cwd, ["show", id, "--json"]);
						return { content: [{ type: "text" as const, text: result || "Issue not found" }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"close_issue",
				"Close an issue with a reason.",
				{
					id: z.string().describe("Issue ID"),
					reason: z.string().describe("Reason for closing"),
				},
				async ({ id, reason }) => {
					try {
						const result = await runBd(cwd, ["close", id, "--reason", reason]);
						return { content: [{ type: "text" as const, text: result || "Issue closed" }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"add_comment",
				"Add a comment to an issue.",
				{
					id: z.string().describe("Issue ID"),
					text: z.string().describe("Comment text"),
				},
				async ({ id, text }) => {
					try {
						const result = await runBd(cwd, ["comments", "add", id, text]);
						return { content: [{ type: "text" as const, text: result || "Comment added" }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"add_dependency",
				"Add a dependency between issues.",
				{
					from: z.string().describe("Source issue ID"),
					to: z.string().describe("Target issue ID"),
					type: z.string().default("blocks").describe("Dependency type"),
				},
				async ({ from, to, type }) => {
					try {
						const result = await runBd(cwd, ["deps", "add", from, to, "--type", type]);
						return { content: [{ type: "text" as const, text: result || "Dependency added" }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"remove_dependency",
				"Remove a dependency between issues.",
				{
					from: z.string().describe("Source issue ID"),
					to: z.string().describe("Target issue ID"),
				},
				async ({ from, to }) => {
					try {
						const result = await runBd(cwd, ["deps", "remove", from, to]);
						return { content: [{ type: "text" as const, text: result || "Dependency removed" }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"add_label",
				"Add a label to an issue.",
				{
					id: z.string().describe("Issue ID"),
					label: z.string().describe("Label to add"),
				},
				async ({ id, label }) => {
					try {
						const result = await runBd(cwd, ["update", id, "--add-label", label]);
						return { content: [{ type: "text" as const, text: result || "Label added" }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"remove_label",
				"Remove a label from an issue.",
				{
					id: z.string().describe("Issue ID"),
					label: z.string().describe("Label to remove"),
				},
				async ({ id, label }) => {
					try {
						const result = await runBd(cwd, ["update", id, "--remove-label", label]);
						return { content: [{ type: "text" as const, text: result || "Label removed" }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			// --- Queue tools ---
			tool(
				"enqueue_ticket",
				"Add a ticket to the agent queue for processing by a worker agent.",
				{
					ticket_id: z.string().describe("Issue ID to enqueue"),
					model: z.string().optional().describe("Model override for the worker"),
					use_worktree: z.boolean().default(false).describe("Use a git worktree for isolation"),
				},
				async ({ ticket_id, model, use_worktree }) => {
					try {
						// Fetch issue details
						const raw = await runBd(cwd, ["show", ticket_id, "--json"]);
						const issue = JSON.parse(raw);
						const agentName = `${ticket_id}-agent`;

						queue.enqueue({
							ticketId: ticket_id,
							agentName,
							cwd,
							title: issue.title || ticket_id,
							description: issue.description || "",
							priority: issue.priority ?? 2,
							issueType: issue.issue_type || "task",
							useWorktree: use_worktree,
							enqueuedAt: new Date().toISOString(),
						});

						return { content: [{ type: "text" as const, text: `Enqueued ${ticket_id} (position ${queue.getItems().length})` }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"cancel_queued",
				"Remove a ticket from the queue.",
				{ ticket_id: z.string().describe("Ticket ID to remove") },
				async ({ ticket_id }) => {
					const removed = queue.cancel(ticket_id);
					return { content: [{ type: "text" as const, text: removed ? `Removed ${ticket_id} from queue` : `${ticket_id} not found in queue` }] };
				}
			),

			tool(
				"reorder_queue",
				"Move a queued ticket to a new position.",
				{
					ticket_id: z.string().describe("Ticket ID to move"),
					position: z.number().describe("Target position (0-based)"),
				},
				async ({ ticket_id, position }) => {
					const items = queue.getItems();
					const fromIndex = items.findIndex(i => i.ticketId === ticket_id);
					if (fromIndex === -1) {
						return { content: [{ type: "text" as const, text: `${ticket_id} not found in queue` }], isError: true };
					}
					queue.reorder(fromIndex, position);
					return { content: [{ type: "text" as const, text: `Moved ${ticket_id} to position ${position}` }] };
				}
			),

			tool(
				"list_queue",
				"List all items currently in the agent queue.",
				{},
				async () => {
					const items = queue.getItems();
					if (items.length === 0) {
						return { content: [{ type: "text" as const, text: "Queue is empty" }] };
					}
					const lines = items.map((item, i) =>
						`${i + 1}. ${item.ticketId} — ${item.title} (priority: ${item.priority}, type: ${item.issueType})`
					);
					return { content: [{ type: "text" as const, text: lines.join("\n") }] };
				}
			),

			// --- Agent tools ---
			tool(
				"list_running_agents",
				"List all currently active agent sessions.",
				{},
				async () => {
					const agents: string[] = [];
					for (const [, session] of sessions) {
						if (session.isRunning && session.agentName) {
							agents.push(`${session.agentName} — cwd: ${session.cwd}, running: ${session.isRunning}`);
						}
					}
					return { content: [{ type: "text" as const, text: agents.length > 0 ? agents.join("\n") : "No running agents" }] };
				}
			),

			tool(
				"stop_agent",
				"Stop a running agent session.",
				{ name_or_ticket_id: z.string().describe("Agent name or ticket ID") },
				async ({ name_or_ticket_id }) => {
					for (const [id, session] of sessions) {
						const matches = session.agentName === name_or_ticket_id
							|| session.agentName === `${name_or_ticket_id}-agent`;
						if (matches) {
							session.abortController.abort();
							sessions.delete(id);
							return { content: [{ type: "text" as const, text: `Stopped agent ${session.agentName}` }] };
						}
					}
					return { content: [{ type: "text" as const, text: `Agent ${name_or_ticket_id} not found` }], isError: true };
				}
			),
		],
	});
}
