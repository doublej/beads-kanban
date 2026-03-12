export type QueueItem = {
	ticketId: string;
	agentName: string;
	cwd: string;
	title: string;
	description: string;
	priority: number;
	issueType: string;
	useWorktree: boolean;
	enqueuedAt: string; // ISO timestamp
};
