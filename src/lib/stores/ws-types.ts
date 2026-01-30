// Type definitions for WebSocket agent sessions

export type NotificationType = 'comment' | 'dependency' | 'attachment' | 'status' | 'priority' | 'assignee' | 'label';

export type SystemMessageSubtype = 'init' | 'compact_start' | 'compact_done' | 'subagent_start' | 'subagent_end' | 'info';

export interface ChatMessage {
	role: 'user' | 'assistant' | 'tool' | 'notification' | 'system';
	content: string;
	toolName?: string;
	toolInput?: Record<string, unknown>;
	toolResult?: string;
	timestamp?: string;
	notificationType?: NotificationType;
	systemSubtype?: SystemMessageSubtype;
}

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	cacheRead: number;
	cacheCreation: number;
}

export interface SlashCommandInfo {
	name: string;
	description: string;
	argumentHint: string;
}

export interface AgentSession {
	id: string;
	name: string;
	cwd: string;
	streaming: boolean;
	messages: ChatMessage[];
	currentDelta: string;
	cost?: number;
	diffs?: FileDiff[];
	serverId?: string;
	sdkSessionId?: string;
	compacted?: boolean;
	usage?: TokenUsage;
	slashCommands?: SlashCommandInfo[];
	pane_type: string;
	backend: string;
	lastReadCount?: number;
	ticketId?: string;
}

export interface FileDiff {
	path: string;
	operation: 'created' | 'modified' | 'deleted';
	before: string | null;
	after: string | null;
}

export interface StreamEvent {
	type: 'stream_event';
	event: { type: string; delta?: { type: string; text?: string } };
}

export interface AssistantMessage {
	type: 'assistant';
	message?: { content: Array<{ type: string; name?: string; text?: string; input?: Record<string, unknown>; id?: string }> };
}

export interface ToolResult {
	type: 'user';
	message?: { content: string | Array<{ type: string; text?: string; tool_use_id?: string }> };
	tool_use_result?: string;
}

export interface ToolCallEvent {
	type: 'tool_call';
	tool_name: string;
	input: Record<string, unknown>;
}

export interface ToolResultEvent {
	type: 'tool_result';
	tool_name: string;
	result: string;
}

export type ServerMessage =
	| { type: 'session_started'; sessionId: string; resuming?: boolean }
	| { type: 'session_resumed'; sessionId: string; sdkSessionId?: string; isRunning?: boolean }
	| { type: 'sdk_session'; sdkSessionId: string; source: 'new' | 'resume'; slashCommands?: SlashCommandInfo[] }
	| { type: 'compacted'; metadata?: unknown }
	| { type: 'system_message'; subtype: SystemMessageSubtype; content: string; agentName?: string }
	| { type: 'usage'; inputTokens: number; outputTokens: number; cacheRead: number; cacheCreation: number }
	| { type: 'session_ended'; sessionId: string }
	| { type: 'session_cleared'; sessionId: string }
	| { type: 'stream'; data: StreamEvent | AssistantMessage | ToolResult | ToolCallEvent | ToolResultEvent | { type: string } }
	| { type: 'done'; result: { subtype: string; total_cost_usd?: number }; diffs?: FileDiff[] }
	| { type: 'error'; error: string }
	| { type: 'interrupted' };

export type Pane = AgentSession;

export interface TicketNotificationContext {
	ticketId: string;
	ticketTitle?: string;
	sender?: string;
}
