// Tab coordination for WebSocket sharing across browser tabs
// Uses BroadcastChannel API for leader election and state sync

const CHANNEL_NAME = 'beads-kanban-ws';
const HEARTBEAT_INTERVAL = 2000;
const LEADER_TIMEOUT = 4000;

interface TabMessage {
	type: 'heartbeat' | 'leader_claim' | 'leader_abdicate' | 'state_update' | 'request_leader' | 'action_request';
	tabId: string;
	timestamp: number;
	payload?: unknown;
}

export interface ActionRequest {
	action: string;
	sessionName: string;
	args: unknown[];
}

type LeaderChangeCallback = (isLeader: boolean) => void;
type StateUpdateCallback = (state: unknown) => void;
type ActionRequestCallback = (request: ActionRequest) => void;

class TabCoordinator {
	private channel: BroadcastChannel | null = null;
	private tabId = crypto.randomUUID();
	private isLeader = false;
	private leaderId: string | null = null;
	private leaderLastSeen = 0;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private leaderCheckTimer: ReturnType<typeof setInterval> | null = null;
	private onLeaderChange: LeaderChangeCallback | null = null;
	private onStateUpdate: StateUpdateCallback | null = null;
	private onActionRequest: ActionRequestCallback | null = null;

	init(
		onLeaderChange: LeaderChangeCallback,
		onStateUpdate: StateUpdateCallback,
		onActionRequest?: ActionRequestCallback
	) {
		if (typeof window === 'undefined') return;
		if (this.channel) return; // Already initialized

		this.onLeaderChange = onLeaderChange;
		this.onStateUpdate = onStateUpdate;
		this.onActionRequest = onActionRequest ?? null;

		this.channel = new BroadcastChannel(CHANNEL_NAME);
		this.channel.onmessage = (e) => this.handleMessage(e.data as TabMessage);

		// Request current leader
		this.broadcast({ type: 'request_leader' });

		// Wait briefly to see if a leader responds, then claim if needed
		setTimeout(() => {
			if (!this.leaderId) {
				this.claimLeadership();
			}
		}, 500);

		// Check for dead leader periodically
		this.leaderCheckTimer = setInterval(() => this.checkLeader(), LEADER_TIMEOUT / 2);
	}

	destroy() {
		this.stopHeartbeat();
		if (this.leaderCheckTimer) {
			clearInterval(this.leaderCheckTimer);
			this.leaderCheckTimer = null;
		}
		if (this.isLeader) {
			this.broadcast({ type: 'leader_abdicate' });
		}
		this.channel?.close();
		this.channel = null;
	}

	getIsLeader(): boolean {
		return this.isLeader;
	}

	getTabId(): string {
		return this.tabId;
	}

	// Broadcast state to all follower tabs
	broadcastState(state: unknown) {
		if (!this.isLeader) return;
		this.broadcast({ type: 'state_update', payload: state });
	}

	// Request an action from the leader (used by follower tabs)
	requestAction(request: ActionRequest) {
		if (this.isLeader) {
			// We're the leader, handle directly
			this.onActionRequest?.(request);
		} else {
			// Forward to leader
			this.broadcast({ type: 'action_request', payload: request });
		}
	}

	private broadcast(msg: Omit<TabMessage, 'tabId' | 'timestamp'>) {
		this.channel?.postMessage({
			...msg,
			tabId: this.tabId,
			timestamp: Date.now()
		} as TabMessage);
	}

	private handleMessage(msg: TabMessage) {
		if (msg.tabId === this.tabId) return; // Ignore own messages

		switch (msg.type) {
			case 'heartbeat':
				if (msg.tabId === this.leaderId) {
					this.leaderLastSeen = msg.timestamp;
				}
				break;

			case 'leader_claim':
				// Accept new leader (first claim wins, or lower tabId wins ties)
				if (!this.leaderId || msg.tabId < this.leaderId) {
					this.acceptLeader(msg.tabId);
				}
				break;

			case 'leader_abdicate':
				if (msg.tabId === this.leaderId) {
					this.leaderId = null;
					this.leaderLastSeen = 0;
					// Try to become new leader
					setTimeout(() => {
						if (!this.leaderId) this.claimLeadership();
					}, Math.random() * 200);
				}
				break;

			case 'state_update':
				if (msg.tabId === this.leaderId && !this.isLeader) {
					this.onStateUpdate?.(msg.payload);
				}
				break;

			case 'request_leader':
				// If we're the leader, announce it
				if (this.isLeader) {
					this.broadcast({ type: 'leader_claim' });
				}
				break;

			case 'action_request':
				// If we're the leader, handle the action request
				if (this.isLeader && msg.payload) {
					this.onActionRequest?.(msg.payload as ActionRequest);
				}
				break;
		}
	}

	private claimLeadership() {
		this.isLeader = true;
		this.leaderId = this.tabId;
		this.leaderLastSeen = Date.now();
		this.broadcast({ type: 'leader_claim' });
		this.startHeartbeat();
		this.onLeaderChange?.(true);
	}

	private acceptLeader(leaderId: string) {
		const wasLeader = this.isLeader;
		this.leaderId = leaderId;
		this.leaderLastSeen = Date.now();

		if (wasLeader) {
			this.isLeader = false;
			this.stopHeartbeat();
			this.onLeaderChange?.(false);
		} else if (leaderId === this.tabId) {
			// We're being told we're the leader (shouldn't happen normally)
			this.isLeader = true;
			this.startHeartbeat();
			this.onLeaderChange?.(true);
		}
	}

	private checkLeader() {
		if (this.isLeader) return;
		if (!this.leaderId) {
			this.claimLeadership();
			return;
		}

		const elapsed = Date.now() - this.leaderLastSeen;
		if (elapsed > LEADER_TIMEOUT) {
			// Leader is dead, claim leadership
			this.leaderId = null;
			this.claimLeadership();
		}
	}

	private startHeartbeat() {
		this.stopHeartbeat();
		this.heartbeatTimer = setInterval(() => {
			this.broadcast({ type: 'heartbeat' });
		}, HEARTBEAT_INTERVAL);
	}

	private stopHeartbeat() {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}
}

export const tabCoordinator = new TabCoordinator();
