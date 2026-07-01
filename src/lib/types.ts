export interface Dependency {
	id: string;
	title: string;
	status: string;
	dependency_type: string;
}

export type AgentModel = '' | 'haiku' | 'sonnet' | 'opus';
export type AgentEffort = '' | 'low' | 'medium' | 'high';

export interface Issue {
	id: string;
	seq: number;
	title: string;
	description: string;
	design?: string;
	acceptance_criteria?: string;
	notes?: string;
	status: 'open' | 'in_progress' | 'hooked' | 'blocked' | 'closed';
	priority: 0 | 1 | 2 | 3 | 4;
	issue_type: string;
	created_at?: string;
	updated_at?: string;
	closed_at?: string;
	close_reason?: string;
	assignee?: string;
	// bd 1.0 scheduling / metadata fields
	estimated_minutes?: number;
	external_ref?: string;
	spec_id?: string;
	ephemeral?: boolean;
	wisp_type?: string;
	pinned?: boolean;
	due_at?: string;
	defer_until?: string;
	started_at?: string;
	agent_state?: string;
	labels?: string[];
	dependencies?: Dependency[];
	dependents?: Dependency[];
	dependency_count?: number;
	dependent_count?: number;
	attachments?: Attachment[];
	comments?: Comment[];
	// Agent overrides
	agent_model?: AgentModel;
	agent_effort?: AgentEffort;
	// UI state
	_showDesign?: boolean;
	_showAcceptance?: boolean;
	_showNotes?: boolean;
}

export interface Comment {
	id: string;
	author: string;
	text: string;
	created_at: string;
}

export interface Attachment {
	filename: string;
	size: number;
	mimetype: string;
	created_at: string;
}

export type ColumnIconName = 'circle' | 'circle-dot' | 'circle-slash' | 'check-circle';

export interface Column {
	key: string;
	status: Issue['status'];
	label: string;
	icon: ColumnIconName;
	accent: string;
}

export interface CardPosition {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface FlyingCard {
	from: CardPosition;
	to: CardPosition;
	issue: Issue;
}

export interface ContextMenuState {
	x: number;
	y: number;
	issue: Issue;
}

export interface RopeDragState {
	fromId: string;
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	targetId: string | null;
}

export type SortBy = 'priority' | 'created' | 'title';
export type PaneSize = 'compact' | 'medium' | 'large';
export type ViewMode = 'kanban' | 'tree' | 'graph' | 'stats' | 'diff';

export interface DiffChange {
	issue: { id: string; title: string; status: string; priority: number; issue_type: string };
	changeType: 'added' | 'closed' | 'reopened' | 'status_changed' | 'priority_changed';
	oldValue?: string;
	newValue?: string;
}

export interface DiffResult {
	rev: string;
	revLabel: string;
	currentCount: number;
	historicalCount: number;
	changes: DiffChange[];
	commits: { hash: string; message: string; date: string }[];
}

export type LoadingPhase = 'disconnected' | 'ready' | 'error';

export interface LoadingStatus {
	phase: LoadingPhase;
	pollCount: number;
	lastUpdate: number | null;
	issueCount: number;
	hasChanges: boolean;
	errorMessage: string | null;
}

export type MutationType = 'status' | 'priority' | 'assignee' | 'comment' | 'dependency' | 'label' | 'created' | 'closed';

export interface MutationEntry {
	id: string;
	timestamp: number;
	ticketId: string;
	ticketTitle: string;
	mutationType: MutationType;
	field: string;
	previousValue: string | null;
	newValue: string;
}

export interface Project {
	path: string;
	name: string;
	lastAccess: string;
	color: string;
}

export interface ViewRecipe {
	id: string;
	name: string;
	filters: {
		searchQuery: string;
		filterPriority: number | 'all';
		filterType: string;
		filterTime: string;
		filterStatus: string;
		filterLabel: string;
		filterActionable: boolean;
	};
	columnSort: Record<string, 'priority' | 'created' | 'title'>;
	collapsedColumns: string[];
	viewMode: ViewMode;
	createdAt: string;
}
