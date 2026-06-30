// Type definitions for WebSocket agent sessions

export type NotificationType = 'comment' | 'dependency' | 'attachment' | 'status' | 'priority' | 'assignee' | 'label';

export type SystemMessageSubtype = 'init' | 'compact_start' | 'compact_done' | 'subagent_start' | 'subagent_end' | 'info' | 'worktree_progress' | 'error' | 'tool_failure' | 'notification';

export interface ChatMessage {
	role: 'user' | 'assistant' | 'tool' | 'notification' | 'system';
	content: string;
	toolName?: string;
	toolInput?: Record<string, unknown>;
	toolResult?: string;
	timestamp?: string;
	notificationType?: NotificationType;
	systemSubtype?: SystemMessageSubtype;
	/** Extended-thinking (reasoning) content, rendered as a collapsible block. */
	thinking?: boolean;
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

export interface ModelInfo {
	value: string;
	displayName: string;
	description: string;
}

export interface McpServerInfo {
	name: string;
	/** 'connected' | 'failed' | 'needs-auth' | 'pending' */
	status: string;
}

export interface PluginInfo {
	name: string;
	path: string;
}

/** SDK-reported session capabilities, surfaced from the init message + supportedModels(). */
export interface AgentCapabilities {
	models: ModelInfo[];
	mcpServers: McpServerInfo[];
	currentModel?: string;
	permissionMode?: string;
	tools?: string[];
	plugins?: PluginInfo[];
}

export interface ActiveRemoteSession {
	sessionId: string;
	name: string;
	cwd: string;
	projectCwd: string;
	isManager: boolean;
	isRunning: boolean;
	ticketId?: string;
	worktreePath?: string;
}

export interface AgentSession {
	id: string;
	name: string;
	cwd: string;
	projectCwd?: string;
	streaming: boolean;
	messages: ChatMessage[];
	currentDelta: string;
	cost?: number;
	currentThinking?: string;
	diffs?: FileDiff[];
	serverId?: string;
	sdkSessionId?: string;
	compacted?: boolean;
	usage?: TokenUsage;
	slashCommands?: SlashCommandInfo[];
	capabilities?: AgentCapabilities;
	/** Effective permission mode for this session (e.g. 'bypassPermissions', 'plan'). */
	permissionMode?: string;
	/** Summary of the most recent completed run (turns, per-model usage, denials). */
	lastRun?: RunSummary;
	pane_type: string;
	backend: string;
	lastReadCount?: number;
	ticketId?: string;
	worktreePath?: string;
	error?: boolean;
	errorMessage?: string;
	isManager?: boolean;
	discoveredFromServer?: boolean;
}

export interface FileDiff {
	path: string;
	operation: 'created' | 'modified' | 'deleted';
	before: string | null;
	after: string | null;
}

/** Per-model token/cost usage reported by the SDK result message. */
export interface RunModelUsage {
	inputTokens: number;
	outputTokens: number;
	cacheReadInputTokens: number;
	cacheCreationInputTokens: number;
	costUSD: number;
}

/** Summary of a completed agent run, derived from the SDK result message. */
export interface RunSummary {
	subtype: string;
	numTurns?: number;
	costUsd?: number;
	modelUsage?: Record<string, RunModelUsage>;
	denials?: number;
	errors?: string[];
}

export interface StreamEvent {
	type: 'stream_event';
	event: { type: string; delta?: { type: string; text?: string; thinking?: string } };
}

export interface AssistantMessage {
	type: 'assistant';
	message?: { content: Array<{ type: string; name?: string; text?: string; thinking?: string; input?: Record<string, unknown>; id?: string }> };
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
	| { type: 'agent_capabilities'; models: ModelInfo[]; mcpServers: McpServerInfo[]; currentModel?: string; permissionMode?: string; tools?: string[]; plugins?: PluginInfo[] }
	| { type: 'model_changed'; model?: string }
	| { type: 'permission_mode_changed'; mode: string }
	| { type: 'compacted'; metadata?: unknown }
	| { type: 'system_message'; subtype: SystemMessageSubtype; content: string; agentName?: string }
	| { type: 'usage'; inputTokens: number; outputTokens: number; cacheRead: number; cacheCreation: number }
	| { type: 'session_ended'; sessionId: string }
	| { type: 'session_cleared'; sessionId: string }
	| { type: 'stream'; data: StreamEvent | AssistantMessage | ToolResult | ToolCallEvent | ToolResultEvent | { type: string } }
	| { type: 'done'; result: { subtype: string; total_cost_usd?: number; modelUsage?: Record<string, RunModelUsage>; num_turns?: number; permission_denials?: unknown[]; errors?: string[] }; diffs?: FileDiff[] }
	| { type: 'error'; error: string }
	| { type: 'interrupted' }
	| { type: 'active_sessions'; cwd: string | null; sessions: ActiveRemoteSession[] }
	| { type: 'queue_state'; items: unknown[] };

export type Pane = AgentSession;

export interface TicketNotificationContext {
	ticketId: string;
	ticketTitle?: string;
	sender?: string;
}
