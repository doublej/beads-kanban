import type { QueueItem } from "./queue-types";
import type { AgentSession } from "./session-types";
import type { ServerWebSocket } from "bun";
import type { WSData } from "./http-server";
import { runBd } from "./bd-runner";
import { log } from "../logger";

type DispatchFn = (item: QueueItem, briefing: string) => Promise<void> | void;

type ActiveSessionSummary = {
	sessionId: string;
	name: string;
	cwd: string;
	projectCwd: string;
	isManager: boolean;
	isRunning: boolean;
	ticketId?: string;
	worktreePath?: string;
};

export class AgentQueue {
	private items: QueueItem[] = [];
	private sessions: Map<string, AgentSession>;
	private dispatchFn: DispatchFn | null = null;
	private clients: Map<ServerWebSocket<WSData>, string | null> = new Map();

	constructor(sessions: Map<string, AgentSession>) {
		this.sessions = sessions;
	}

	setDispatchFn(fn: DispatchFn) {
		this.dispatchFn = fn;
	}

	addClient(ws: ServerWebSocket<WSData>) {
		this.clients.set(ws, null);
		// No initial state — wait for set_project to avoid leaking all items.
		try {
			ws.send(JSON.stringify({ type: "queue_state", items: [] }));
			ws.send(JSON.stringify({ type: "active_sessions", cwd: null, sessions: [] }));
		} catch {}
	}

	removeClient(ws: ServerWebSocket<WSData>) {
		this.clients.delete(ws);
	}

	setClientCwd(ws: ServerWebSocket<WSData>, cwd: string) {
		if (!this.clients.has(ws)) return;
		this.clients.set(ws, cwd);
		try {
			ws.send(JSON.stringify({
				type: "queue_state",
				items: this.items.filter(i => i.cwd === cwd),
			}));
			ws.send(JSON.stringify({
				type: "active_sessions",
				cwd,
				sessions: this.buildActiveSessions().filter(s => s.projectCwd === cwd),
			}));
		} catch {}
	}

	getItemsForCwd(cwd: string): QueueItem[] {
		return this.items.filter(i => i.cwd === cwd);
	}

	enqueue(item: QueueItem) {
		this.items.push(item);
		this.broadcastState();
		this.maybeStartNext();
	}

	cancel(ticketId: string): boolean {
		const before = this.items.length;
		this.items = this.items.filter(i => i.ticketId !== ticketId);
		if (this.items.length !== before) {
			this.broadcastState();
			return true;
		}
		return false;
	}

	reorder(fromIndex: number, toIndex: number) {
		if (fromIndex < 0 || fromIndex >= this.items.length) return;
		if (toIndex < 0 || toIndex >= this.items.length) return;
		if (fromIndex === toIndex) return;

		const [moved] = this.items.splice(fromIndex, 1);
		this.items.splice(toIndex, 0, moved);
		this.broadcastState();
		this.maybeStartNext();
	}

	getItems(): QueueItem[] {
		return [...this.items];
	}

	peek(): QueueItem | undefined {
		return this.items[0];
	}

	dequeueNext(): QueueItem | undefined {
		const item = this.items.shift();
		if (item) this.broadcastState();
		return item;
	}

	broadcastState() {
		for (const [ws, cwd] of this.clients) {
			if (!cwd) continue;
			try {
				ws.send(JSON.stringify({
					type: "queue_state",
					items: this.items.filter(i => i.cwd === cwd),
				}));
			} catch {}
		}
	}

	broadcastActiveSessions() {
		const all = this.buildActiveSessions();
		for (const [ws, cwd] of this.clients) {
			if (!cwd) continue;
			try {
				ws.send(JSON.stringify({
					type: "active_sessions",
					cwd,
					sessions: all.filter(s => s.projectCwd === cwd),
				}));
			} catch {}
		}
	}

	async maybeStartNext() {
		if (!this.dispatchFn) return;
		if (this.items.length === 0) return;

		const next = this.items[0];
		if (!next.useWorktree && this.hasRunningWorkerInCwd(next.cwd)) return;

		// Dequeue and dispatch
		this.items.shift();
		this.broadcastState();

		try {
			const briefing = await this.buildBriefing(next);
			await this.dispatchFn(next, briefing);
		} catch (err) {
			this.items.unshift(next);
			this.broadcastState();
			log.error(`[queue] Failed to dispatch ${next.ticketId}:`, err);
		}
	}

	hasRunningWorkerInCwd(cwd: string): boolean {
		for (const session of this.sessions.values()) {
			if (!session.isRunning) continue;
			if (session.isManager) continue;
			if (session.cwd === cwd) return true;
		}
		return false;
	}

	private buildActiveSessions(): ActiveSessionSummary[] {
		const sessions: ActiveSessionSummary[] = [];
		for (const session of this.sessions.values()) {
			if (!session.isRunning) continue;
			if (!session.agentName) continue;

			sessions.push({
				sessionId: session.id,
				name: session.agentName,
				cwd: session.cwd,
				projectCwd: session.projectCwd ?? session.cwd,
				isManager: !!session.isManager,
				isRunning: session.isRunning,
				ticketId: session.ticketId ?? (session.agentName.endsWith("-agent")
					? session.agentName.slice(0, -6)
					: undefined),
				worktreePath: session.worktreePath,
			});
		}
		return sessions;
	}

	private async buildBriefing(item: QueueItem): Promise<string> {
		let comments = "";
		let attachments = "";

		try {
			const raw = await runBd(item.cwd, ["comments", "list", item.ticketId, "--json"]);
			comments = raw || "None";
		} catch {
			comments = "None";
		}

		try {
			const raw = await runBd(item.cwd, ["attachments", "list", item.ticketId, "--json"]);
			attachments = raw || "None";
		} catch {
			attachments = "None";
		}

		return `<assignment id="${item.ticketId}" name="${item.agentName}">
<context>You are assigned to ticket ${item.ticketId}.</context>
<task>
<title>${item.title}</title>
<description>${item.description}</description>
<comments>${comments}</comments>
<attachments>${attachments}</attachments>
</task>
<instructions>
Start by claiming the ticket (set status to in_progress), then implement the required changes.
</instructions>
</assignment>`;
	}
}
