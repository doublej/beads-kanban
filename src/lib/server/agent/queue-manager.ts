import type { QueueItem } from "./queue-types";
import type { AgentSession } from "./session-types";
import type { ServerWebSocket } from "bun";
import type { WSData } from "./http-server";
import { runBd } from "./bd-runner";

type DispatchFn = (item: QueueItem, briefing: string) => void;

export class AgentQueue {
	private items: QueueItem[] = [];
	private sessions: Map<string, AgentSession>;
	private dispatchFn: DispatchFn | null = null;
	private clients: Set<ServerWebSocket<WSData>> = new Set();

	constructor(sessions: Map<string, AgentSession>) {
		this.sessions = sessions;
	}

	setDispatchFn(fn: DispatchFn) {
		this.dispatchFn = fn;
	}

	addClient(ws: ServerWebSocket<WSData>) {
		this.clients.add(ws);
	}

	removeClient(ws: ServerWebSocket<WSData>) {
		this.clients.delete(ws);
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
		const msg = JSON.stringify({
			type: "queue_state",
			items: this.items,
		});
		for (const ws of this.clients) {
			try { ws.send(msg); } catch {}
		}
	}

	async maybeStartNext() {
		if (!this.dispatchFn) return;
		if (this.items.length === 0) return;

		const next = this.items[0];
		// Check if a session is already running in this cwd
		for (const session of this.sessions.values()) {
			if (session.isRunning && session.cwd === next.cwd) return;
		}

		// Dequeue and dispatch
		this.items.shift();
		this.broadcastState();

		try {
			const briefing = await this.buildBriefing(next);
			this.dispatchFn(next, briefing);
		} catch (err) {
			console.error(`[queue] Failed to dispatch ${next.ticketId}:`, err);
		}
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
