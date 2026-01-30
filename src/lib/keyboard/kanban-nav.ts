import type { Issue } from '$lib/types';
import { columns, getIssueColumn } from '$lib/utils';

export interface KeyboardNavContext {
	getFilteredIssues: () => Issue[];
	getSelectedId: () => string | null;
	setSelectedId: (id: string | null) => void;
	getPanelOpen: () => boolean;
	getIsCreating: () => boolean;
	getShowKeyboardHelp: () => boolean;
	setShowKeyboardHelp: (v: boolean) => void;
	getShowHotkeys: () => boolean;
	setShowHotkeys: (v: boolean) => void;
	getShowProjectSwitcher: () => boolean;
	setShowProjectSwitcher: (v: boolean) => void;
	getProjectCount: () => number;
	createIssue: () => void;
	openCreatePanel: () => void;
	openEditPanel: (issue: Issue) => void;
	deleteIssue: (id: string) => void;
	toggleTheme: () => void;
	closePanel: () => void;
}

function getCardGrid(filteredIssues: Issue[]): Issue[][] {
	return columns.map(col => filteredIssues.filter(i => getIssueColumn(i).key === col.key));
}

function findCardPosition(filteredIssues: Issue[], id: string): { col: number; row: number } | null {
	const grid = getCardGrid(filteredIssues);
	for (let col = 0; col < grid.length; col++) {
		const row = grid[col].findIndex(i => i.id === id);
		if (row !== -1) return { col, row };
	}
	return null;
}

function getCardAt(filteredIssues: Issue[], col: number, row: number): string | null {
	const grid = getCardGrid(filteredIssues);
	if (col < 0 || col >= grid.length) return null;
	const column = grid[col];
	if (row < 0 || row >= column.length) return null;
	return column[row]?.id ?? null;
}

function isInputElement(target: EventTarget | null): boolean {
	return target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement;
}

function handleGlobalShortcuts(e: KeyboardEvent, ctx: KeyboardNavContext): boolean {
	// Cmd/Ctrl+Enter to submit create form
	if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && ctx.getIsCreating()) {
		e.preventDefault();
		ctx.createIssue();
		return true;
	}

	// Cmd/Ctrl+K to focus search
	if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
		e.preventDefault();
		const searchInput = document.querySelector('.search-input') as HTMLInputElement;
		searchInput?.focus();
		searchInput?.select();
		return true;
	}

	// Cmd/Ctrl+` or Ctrl+Tab to open project switcher
	if ((e.metaKey || e.ctrlKey) && (e.key === '`' || e.key === 'Tab') && ctx.getProjectCount() > 1) {
		e.preventDefault();
		ctx.setShowProjectSwitcher(true);
		return true;
	}

	return false;
}

function handleEscape(e: KeyboardEvent, ctx: KeyboardNavContext): boolean {
	if (e.key !== 'Escape') return false;

	if (ctx.getShowProjectSwitcher()) {
		ctx.setShowProjectSwitcher(false);
		e.preventDefault();
		return true;
	}
	if (ctx.getShowKeyboardHelp()) {
		ctx.setShowKeyboardHelp(false);
		e.preventDefault();
		return true;
	}
	if (isInputElement(e.target)) {
		(e.target as HTMLElement).blur();
		e.preventDefault();
		return true;
	}
	if (ctx.getPanelOpen()) {
		ctx.closePanel();
	} else {
		ctx.setSelectedId(null);
	}
	e.preventDefault();
	return true;
}

function handleNonInputShortcuts(e: KeyboardEvent, ctx: KeyboardNavContext): boolean {
	if (e.key === 'Alt') {
		ctx.setShowHotkeys(true);
		return true;
	}
	if (e.key === '?') {
		ctx.setShowKeyboardHelp(!ctx.getShowKeyboardHelp());
		e.preventDefault();
		return true;
	}
	if (e.key === '/') {
		e.preventDefault();
		const searchInput = document.querySelector('.search-input') as HTMLInputElement;
		searchInput?.focus();
		return true;
	}
	if (e.key === 'n' || e.key === 'N') {
		e.preventDefault();
		ctx.openCreatePanel();
		return true;
	}
	if (e.key === 't' || e.key === 'T') {
		ctx.toggleTheme();
		e.preventDefault();
		return true;
	}
	return false;
}

function handleColumnJump(e: KeyboardEvent, ctx: KeyboardNavContext): boolean {
	const colIndex = parseInt(e.key) - 1;
	if (colIndex < 0 || colIndex >= columns.length) return false;

	const filtered = ctx.getFilteredIssues();
	const targetColumn = columns[colIndex];
	const columnIssues = filtered.filter(i => getIssueColumn(i).key === targetColumn.key);
	if (columnIssues.length > 0) {
		ctx.setSelectedId(columnIssues[0].id);
	}
	e.preventDefault();
	return true;
}

const NAV_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'j', 'k', 'h', 'l'];

function handleCardNavigation(e: KeyboardEvent, ctx: KeyboardNavContext): boolean {
	const filtered = ctx.getFilteredIssues();
	const selectedId = ctx.getSelectedId();

	if (!selectedId && filtered.length > 0 && NAV_KEYS.includes(e.key)) {
		ctx.setSelectedId(filtered[0].id);
		e.preventDefault();
		return true;
	}
	if (!selectedId) return false;

	const pos = findCardPosition(filtered, selectedId);
	if (!pos) return false;

	let newId: string | null = null;

	if (e.key === 'ArrowUp' || e.key === 'k') {
		newId = getCardAt(filtered, pos.col, pos.row - 1);
	} else if (e.key === 'ArrowDown' || e.key === 'j') {
		newId = getCardAt(filtered, pos.col, pos.row + 1);
	} else if (e.key === 'ArrowLeft' || e.key === 'h') {
		newId = findFirstInDirection(filtered, pos, -1);
	} else if (e.key === 'ArrowRight' || e.key === 'l') {
		newId = findFirstInDirection(filtered, pos, 1);
	} else if (e.key === 'Enter' || e.key === 'o') {
		const issue = filtered.find(i => i.id === selectedId);
		if (issue) ctx.openEditPanel(issue);
		e.preventDefault();
		return true;
	} else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'x') {
		ctx.deleteIssue(selectedId);
		e.preventDefault();
		return true;
	}

	if (newId) {
		ctx.setSelectedId(newId);
		e.preventDefault();
	}
	return newId !== null;
}

function findFirstInDirection(
	filtered: Issue[],
	pos: { col: number; row: number },
	direction: -1 | 1
): string | null {
	const grid = getCardGrid(filtered);
	const start = pos.col + direction;
	const end = direction === -1 ? -1 : grid.length;
	for (let c = start; c !== end; c += direction) {
		if (grid[c].length > 0) {
			return grid[c][Math.min(pos.row, grid[c].length - 1)].id;
		}
	}
	return null;
}

export function createKeyboardNav(ctx: KeyboardNavContext) {
	function handleKeydown(e: KeyboardEvent) {
		if (handleGlobalShortcuts(e, ctx)) return;
		if (handleEscape(e, ctx)) return;
		if (isInputElement(e.target)) return;
		if (handleNonInputShortcuts(e, ctx)) return;
		if (handleColumnJump(e, ctx)) return;
		if (ctx.getPanelOpen()) return;
		handleCardNavigation(e, ctx);
	}

	function handleKeyup(e: KeyboardEvent) {
		if (e.key === 'Alt') ctx.setShowHotkeys(false);
	}

	function handleWindowBlur() {
		ctx.setShowHotkeys(false);
	}

	return { handleKeydown, handleKeyup, handleWindowBlur };
}
