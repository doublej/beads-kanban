import type { Issue } from '$lib/types';
import { getColumnMoveUpdates, hasOpenBlockers, columns } from '$lib/utils';

interface CardDragContext {
	getIssues: () => Issue[];
	updateIssue: (id: string, updates: Partial<Issue>) => Promise<void>;
	getActiveColumnIndex: () => number;
	setActiveColumnIndex: (idx: number) => void;
	closePanel: () => void;
}

export function createCardDrag(ctx: CardDragContext) {
	let draggedId = $state<string | null>(null);
	let draggedOverColumn = $state<string | null>(null);
	let dropIndicatorIndex = $state<number | null>(null);
	let dropTargetColumn = $state<string | null>(null);
	let touchStartX = $state(0);
	let touchEndX = $state(0);
	let touchStartY = $state(0);
	let touchEndY = $state(0);
	let panelTouchStartY = $state(0);
	let panelDragOffset = $state(0);
	let isPanelDragging = $state(false);

	function handleDragStart(e: DragEvent, id: string) {
		draggedId = id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', id);
		}
		const target = e.target as HTMLElement;
		target.classList.add('dragging');
	}

	function handleDragEnd(e: DragEvent) {
		draggedId = null;
		draggedOverColumn = null;
		dropIndicatorIndex = null;
		dropTargetColumn = null;
		const target = e.target as HTMLElement;
		target.classList.remove('dragging');
	}

	function handleDragOver(e: DragEvent, columnKey: string) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		draggedOverColumn = columnKey;

		const column = e.currentTarget as HTMLElement;
		const cards = column.querySelector('.cards');
		if (!cards) return;

		const cardElements = Array.from(cards.querySelectorAll('.card:not(.dragging)'));
		const mouseY = e.clientY;

		let insertIndex = cardElements.length;
		for (let i = 0; i < cardElements.length; i++) {
			const rect = cardElements[i].getBoundingClientRect();
			const midY = rect.top + rect.height / 2;
			if (mouseY < midY) {
				insertIndex = i;
				break;
			}
		}

		dropIndicatorIndex = insertIndex;
		dropTargetColumn = columnKey;
	}

	function handleDragLeave(e: DragEvent, columnKey: string) {
		const relatedTarget = e.relatedTarget as HTMLElement;
		const currentTarget = e.currentTarget as HTMLElement;
		if (!currentTarget.contains(relatedTarget)) {
			if (draggedOverColumn === columnKey) {
				draggedOverColumn = null;
			}
			if (dropTargetColumn === columnKey) {
				dropIndicatorIndex = null;
				dropTargetColumn = null;
			}
		}
	}

	function handleDrop(e: DragEvent, columnKey: string) {
		e.preventDefault();
		if (draggedId) {
			const issue = ctx.getIssues().find(i => i.id === draggedId);
			if (issue && columnKey === 'closed' && hasOpenBlockers(issue)) {
				draggedId = null;
				draggedOverColumn = null;
				dropIndicatorIndex = null;
				dropTargetColumn = null;
				return;
			}
			if (issue) {
				const updates = getColumnMoveUpdates(issue, columnKey);
				if (Object.keys(updates).length > 0) {
					ctx.updateIssue(draggedId, updates);
				}
			}
			draggedId = null;
			draggedOverColumn = null;
			dropIndicatorIndex = null;
			dropTargetColumn = null;
		}
	}

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].screenX;
		touchStartY = e.changedTouches[0].screenY;
	}

	function handleTouchEnd(e: TouchEvent) {
		touchEndX = e.changedTouches[0].screenX;
		touchEndY = e.changedTouches[0].screenY;
		handleSwipe();
	}

	function handleSwipe() {
		const swipeThreshold = 50;
		const diffX = touchStartX - touchEndX;
		const diffY = touchStartY - touchEndY;
		if (Math.abs(diffX) < swipeThreshold || Math.abs(diffY) > Math.abs(diffX)) return;
		const colCount = columns.length;
		const idx = ctx.getActiveColumnIndex();
		if (diffX > 0 && idx < colCount - 1) ctx.setActiveColumnIndex(idx + 1);
		else if (diffX < 0 && idx > 0) ctx.setActiveColumnIndex(idx - 1);
	}

	function handlePanelTouchStart(e: TouchEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.panel-header')) return;
		panelTouchStartY = e.touches[0].clientY;
		isPanelDragging = true;
		panelDragOffset = 0;
	}

	function handlePanelTouchMove(e: TouchEvent) {
		if (!isPanelDragging) return;
		const diff = e.touches[0].clientY - panelTouchStartY;
		panelDragOffset = Math.max(0, diff);
	}

	function handlePanelTouchEnd() {
		if (!isPanelDragging) return;
		isPanelDragging = false;
		if (panelDragOffset > 100) {
			ctx.closePanel();
		}
		panelDragOffset = 0;
	}

	return {
		get draggedId() { return draggedId; },
		set draggedId(v) { draggedId = v; },
		get draggedOverColumn() { return draggedOverColumn; },
		set draggedOverColumn(v) { draggedOverColumn = v; },
		get dropIndicatorIndex() { return dropIndicatorIndex; },
		set dropIndicatorIndex(v) { dropIndicatorIndex = v; },
		get dropTargetColumn() { return dropTargetColumn; },
		set dropTargetColumn(v) { dropTargetColumn = v; },
		get isPanelDragging() { return isPanelDragging; },
		get panelDragOffset() { return panelDragOffset; },
		handleDragStart,
		handleDragEnd,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		handleTouchStart,
		handleTouchEnd,
		handlePanelTouchStart,
		handlePanelTouchMove,
		handlePanelTouchEnd
	};
}
