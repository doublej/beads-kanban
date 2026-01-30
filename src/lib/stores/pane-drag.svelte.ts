import { browser } from '$app/environment';
import type { PaneSize } from '$lib/types';

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function createPaneDrag() {
	let draggingPane = $state<string | null>(null);
	let resizingPane = $state<string | null>(null);
	let resizeEdge = $state<ResizeEdge | null>(null);
	let dragOffset = $state({ x: 0, y: 0 });
	let resizeStart = $state({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 });
	let panePositions = $state<Record<string, { x: number; y: number }>>({});
	let paneCustomSizes = $state<Record<string, { w: number; h: number }>>({});
	let paneSizes = $state<Record<string, PaneSize>>({});

	function cyclePaneSize(name: string) {
		const current = paneSizes[name] || 'compact';
		const next: PaneSize = current === 'compact' ? 'medium' : current === 'medium' ? 'large' : 'compact';
		paneSizes = { ...paneSizes, [name]: next };
		if (next !== 'large') {
			const { [name]: _p, ...restPos } = panePositions;
			const { [name]: _s, ...restSize } = paneCustomSizes;
			panePositions = restPos;
			paneCustomSizes = restSize;
		}
	}

	function getPaneSize(name: string): PaneSize {
		return paneSizes[name] || 'compact';
	}

	function getPaneStyle(name: string): string {
		const pos = panePositions[name];
		const size = paneCustomSizes[name];
		const parts: string[] = [];
		if (pos) parts.push(`left: ${pos.x}px`, `top: ${pos.y}px`, `position: fixed`);
		if (size) parts.push(`width: ${size.w}px`, `max-height: ${size.h}px`);
		return parts.join('; ');
	}

	function isCustomized(name: string): boolean {
		return !!(panePositions[name] || paneCustomSizes[name]);
	}

	function startDrag(e: MouseEvent, name: string) {
		if ((e.target as HTMLElement).closest('.ctrl-btn, .msg-input, button')) return;
		e.preventDefault();
		const el = (e.currentTarget as HTMLElement).closest('.agent-window') as HTMLElement;
		const rect = el.getBoundingClientRect();
		draggingPane = name;
		dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		if (!panePositions[name]) {
			panePositions = { ...panePositions, [name]: { x: rect.left, y: rect.top } };
		}
	}

	function startResize(e: MouseEvent, name: string, edge: ResizeEdge) {
		e.preventDefault();
		e.stopPropagation();
		resizingPane = name;
		resizeEdge = edge;
		const el = document.querySelector(`[data-pane="${name}"]`) as HTMLElement;
		const rect = el.getBoundingClientRect();
		resizeStart = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height, px: rect.left, py: rect.top };
		if (!panePositions[name]) {
			panePositions = { ...panePositions, [name]: { x: rect.left, y: rect.top } };
		}
		if (!paneCustomSizes[name]) {
			paneCustomSizes = { ...paneCustomSizes, [name]: { w: rect.width, h: rect.height } };
		}
	}

	function handleDocumentMouseMove(e: MouseEvent) {
		if (draggingPane) {
			e.preventDefault();
			const el = document.querySelector(`[data-pane="${draggingPane}"]`) as HTMLElement;
			if (el) {
				const x = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.x));
				const y = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.y));
				el.style.left = `${x}px`;
				el.style.top = `${y}px`;
				el.style.position = 'fixed';
				panePositions[draggingPane] = { x, y };
			}
		}
		if (resizingPane && resizeEdge) {
			e.preventDefault();
			const el = document.querySelector(`[data-pane="${resizingPane}"]`) as HTMLElement;
			if (!el) return;
			const dx = e.clientX - resizeStart.x;
			const dy = e.clientY - resizeStart.y;
			let w = resizeStart.w, h = resizeStart.h, x = resizeStart.px, y = resizeStart.py;

			if (resizeEdge.includes('e')) {
				w = Math.max(280, Math.min(window.innerWidth - x - 10, resizeStart.w + dx));
			}
			if (resizeEdge.includes('w')) {
				const newW = Math.max(280, resizeStart.w - dx);
				const maxW = resizeStart.px + resizeStart.w - 10;
				w = Math.min(newW, maxW);
				x = resizeStart.px + resizeStart.w - w;
			}
			if (resizeEdge.includes('s')) {
				h = Math.max(200, Math.min(window.innerHeight - y - 50, resizeStart.h + dy));
			}
			if (resizeEdge === 'n' || resizeEdge === 'ne' || resizeEdge === 'nw') {
				const newH = Math.max(200, resizeStart.h - dy);
				const maxH = resizeStart.py + resizeStart.h - 10;
				h = Math.min(newH, maxH);
				y = resizeStart.py + resizeStart.h - h;
			}

			el.style.width = `${w}px`;
			el.style.height = `${h}px`;
			el.style.left = `${x}px`;
			el.style.top = `${y}px`;
			el.style.position = 'fixed';
			paneCustomSizes[resizingPane] = { w, h };
			panePositions[resizingPane] = { x, y };
		}
	}

	function handleDocumentMouseUp() {
		if (draggingPane) {
			panePositions = { ...panePositions };
		}
		if (resizingPane) {
			paneCustomSizes = { ...paneCustomSizes };
			panePositions = { ...panePositions };
		}
		draggingPane = null;
		resizingPane = null;
		resizeEdge = null;
	}

	/** Call from an $effect in the component to attach document-level listeners. */
	function setupListeners() {
		if (!browser) return;
		const isDraggingOrResizing = draggingPane !== null || resizingPane !== null;
		if (!isDraggingOrResizing) return;

		document.addEventListener('mousemove', handleDocumentMouseMove, { passive: false });
		document.addEventListener('mouseup', handleDocumentMouseUp);
		const cursorMap: Record<string, string> = {
			n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
			ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize'
		};
		document.body.style.cursor = draggingPane ? 'grabbing' : (resizeEdge ? cursorMap[resizeEdge] : '');
		document.body.style.userSelect = 'none';
		return () => {
			document.removeEventListener('mousemove', handleDocumentMouseMove);
			document.removeEventListener('mouseup', handleDocumentMouseUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		};
	}

	return {
		get draggingPane() { return draggingPane; },
		get resizingPane() { return resizingPane; },
		get paneSizes() { return paneSizes; },
		get panePositions() { return panePositions; },
		get paneCustomSizes() { return paneCustomSizes; },
		cyclePaneSize,
		getPaneSize,
		getPaneStyle,
		isCustomized,
		startDrag,
		startResize,
		setupListeners,
	};
}
