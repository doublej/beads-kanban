export type QueueItem = {
	ticketId: string;
	agentName: string;
	cwd: string;
	title: string;
	description: string;
	priority: number;
	issueType: string;
	model?: string;
	useWorktree: boolean;
	enqueuedAt: string; // ISO timestamp
};
