export interface Dependency {
	id: string;
	title: string;
	status: string;
	dependency_type: string;
}

export interface Issue {
	id: string;
	title: string;
	description: string;
	design?: string;
	acceptance_criteria?: string;
	notes?: string;
	status: 'open' | 'in_progress' | 'blocked' | 'closed';
	priority: 1 | 2 | 3 | 4;
	issue_type: string;
	created_at?: string;
	updated_at?: string;
	closed_at?: string;
	assignee?: string;
	labels?: string[];
	dependencies?: Dependency[];
	dependents?: Dependency[];
	dependency_count?: number;
	dependent_count?: number;
	// UI state
	_showDesign?: boolean;
	_showAcceptance?: boolean;
	_showNotes?: boolean;
}

export interface Comment {
	id: number;
	author: string;
	text: string;
	created_at: string;
}

export interface Column {
	key: Issue['status'];
	label: string;
	icon: string;
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
