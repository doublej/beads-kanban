<script lang="ts">
	import { untrack } from 'svelte';
	import type { Pane, SdkSessionInfo } from '$lib/wsStore.svelte';
	import AgentPane from './AgentPane.svelte';
	import SessionPickerModal from './SessionPickerModal.svelte';

	interface Props {
		wsPanes: Map<string, Pane>;
		expandedPanes: Set<string>;
		paneSizes: Record<string, 'compact' | 'medium' | 'large'>;
		panePositions: Record<string, { x: number; y: number }>;
		paneCustomSizes: Record<string, { w: number; h: number }>;
		paneMessageInputs: Record<string, string>;
		draggingPane: string | null;
		resizingPane: string | null;
		disabled?: boolean;
		toolsExpandedByDefault?: boolean;
		getUnreadCount?: (name: string) => number;
		onStartDrag: (e: MouseEvent, name: string) => void;
		onStartResize: (e: MouseEvent, name: string, edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => void;
		onCyclePaneSize: (name: string) => void;
		onRemovePane: (name: string) => void;
		onMinimizePane: (name: string) => void;
		onSendMessage: (name: string, message: string) => void;
		onMouseMove: (e: MouseEvent) => void;
		onMouseUp: () => void;
		onEndSession?: (name: string) => void;
		onClearSession?: (name: string) => void;
		onContinueSession?: (name: string) => void;
		onCompactSession?: (name: string) => void;
		onFetchSessions?: () => Promise<SdkSessionInfo[]>;
		onResumeSession?: (name: string, sessionId: string) => void;
		onMarkAsRead?: (name: string) => void;
		onOpenTicket?: (ticketId: string) => void;
	}

	let {
		wsPanes,
		expandedPanes,
		paneSizes,
		panePositions,
		paneCustomSizes,
		paneMessageInputs = $bindable(),
		draggingPane,
		resizingPane,
		disabled = false,
		toolsExpandedByDefault = false,
		getUnreadCount,
		onStartDrag,
		onStartResize,
		onCyclePaneSize,
		onRemovePane,
		onMinimizePane,
		onSendMessage,
		onMouseMove,
		onMouseUp,
		onEndSession,
		onClearSession,
		onContinueSession,
		onCompactSession,
		onFetchSessions,
		onResumeSession,
		onMarkAsRead,
		onOpenTicket
	}: Props = $props();

	let messagesRefs = $state<Record<string, HTMLDivElement | null>>({});
	let inputRefs = $state<Record<string, HTMLInputElement | null>>({});
	let openMenuPane = $state<string | null>(null);
	let sessionPickerPane = $state<string | null>(null);
	let sessionPickerSessions = $state<SdkSessionInfo[]>([]);
	let sessionPickerLoading = $state(false);
	let activePaneName = $state<string | null>(null);
	let autoscrollEnabled = $state<Record<string, boolean>>({});

	// Auto-focus input when pane opens and mark as read
	let prevExpandedPanes: Set<string> = new Set();
	$effect(() => {
		const expanded = [...expandedPanes];
		const prev = untrack(() => prevExpandedPanes);
		for (const name of expanded) {
			if (!prev.has(name)) {
				setTimeout(() => inputRefs[name]?.focus(), 50);
				onMarkAsRead?.(name);
			}
		}
		prevExpandedPanes = new Set(expanded);
	});

	function getPaneSize(name: string): 'compact' | 'medium' | 'large' {
		return paneSizes[name] || 'compact';
	}

	function getPaneStyle(name: string): string {
		const pos = panePositions[name];
		const size = paneCustomSizes[name];
		const parts: string[] = [];
		if (pos) parts.push(`left: ${pos.x}px`, `top: ${pos.y}px`, `position: fixed`);
		if (size) parts.push(`width: ${size.w}px`, `height: ${size.h}px`);
		return parts.join('; ');
	}

	function getSliceSize(size: 'compact' | 'medium' | 'large'): number {
		return size === 'large' ? 200 : size === 'medium' ? 80 : 40;
	}

	function getFirstUnreadIndex(pane: Pane, size: 'compact' | 'medium' | 'large'): number | null {
		const unread = getUnreadCount?.(pane.name) ?? 0;
		if (unread <= 0) return null;
		const sliceSize = getSliceSize(size);
		const sliceStart = Math.max(0, pane.messages.length - sliceSize);
		const firstUnreadAbsolute = pane.messages.length - unread;
		const relativeIndex = firstUnreadAbsolute - sliceStart;
		return relativeIndex >= 0 ? relativeIndex : 0;
	}

	function isAutoscrollEnabled(name: string): boolean {
		return autoscrollEnabled[name] !== false;
	}

	function toggleAutoscroll(name: string) {
		autoscrollEnabled[name] = !isAutoscrollEnabled(name);
		autoscrollEnabled = { ...autoscrollEnabled };
	}

	function toggleMenu(name: string) {
		openMenuPane = openMenuPane === name ? null : name;
	}

	async function openSessionPicker(paneName: string) {
		if (!onFetchSessions) return;
		sessionPickerPane = paneName;
		sessionPickerLoading = true;
		sessionPickerSessions = await onFetchSessions();
		sessionPickerLoading = false;
		openMenuPane = null;
	}

	function handleSessionSelect(sessionId: string) {
		if (onResumeSession && sessionPickerPane) {
			onResumeSession(sessionPickerPane, sessionId);
			sessionPickerPane = null;
		}
	}

	// Debounced scroll for active pane
	let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const _panes = [...wsPanes.entries()];
		const active = activePaneName;
		if (scrollTimeout) clearTimeout(scrollTimeout);
		scrollTimeout = setTimeout(() => {
			if (active && isAutoscrollEnabled(active)) {
				const pane = wsPanes.get(active);
				const ref = messagesRefs[active];
				if (ref && pane && (pane.messages.length > 0 || pane.currentDelta)) {
					ref.scrollTop = ref.scrollHeight;
				}
			}
		}, 50);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="agent-windows"
	class:has-large={Object.values(paneSizes).includes('large')}
	onmousemove={onMouseMove}
	onmouseup={onMouseUp}
	onmouseleave={onMouseUp}
>
	{#each [...wsPanes.values()].filter(p => expandedPanes.has(p.name)) as pane}
		{@const size = getPaneSize(pane.name)}
		<AgentPane
			{pane}
			{size}
			customized={!!(panePositions[pane.name] || paneCustomSizes[pane.name])}
			isDragging={draggingPane === pane.name}
			isResizing={resizingPane === pane.name}
			isActive={activePaneName === pane.name}
			style={getPaneStyle(pane.name)}
			bind:messageInput={paneMessageInputs[pane.name]}
			{disabled}
			{toolsExpandedByDefault}
			firstUnreadIndex={getFirstUnreadIndex(pane, size)}
			isMenuOpen={openMenuPane === pane.name}
			isAutoscrollEnabled={isAutoscrollEnabled(pane.name)}
			bind:messagesRef={messagesRefs[pane.name]}
			bind:inputRef={inputRefs[pane.name]}
			onSetActive={() => activePaneName = pane.name}
			onStartDrag={(e) => onStartDrag(e, pane.name)}
			onStartResize={(e, edge) => onStartResize(e, pane.name, edge)}
			{onRemovePane}
			{onMinimizePane}
			{onCyclePaneSize}
			{onSendMessage}
			onInputChange={(value) => paneMessageInputs[pane.name] = value}
			onToggleMenu={() => toggleMenu(pane.name)}
			onCloseMenu={() => openMenuPane = null}
			onToggleAutoscroll={() => toggleAutoscroll(pane.name)}
			{onOpenTicket}
			{onEndSession}
			{onClearSession}
			{onContinueSession}
			{onCompactSession}
			{onFetchSessions}
			onOpenSessionPicker={() => openSessionPicker(pane.name)}
		/>
	{/each}
</div>

{#if sessionPickerPane}
	<SessionPickerModal
		paneName={sessionPickerPane}
		sessions={sessionPickerSessions}
		loading={sessionPickerLoading}
		onSelect={handleSessionSelect}
		onClose={() => sessionPickerPane = null}
	/>
{/if}

<style>
	.agent-windows {
		display: flex;
		gap: 0.5rem;
		padding: 0 0.75rem 0.375rem;
		pointer-events: none;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: flex-end;
	}

	.agent-windows.has-large {
		position: fixed;
		inset: 0;
		padding: 2rem;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(8px);
		z-index: 999;
		justify-content: center;
		align-items: center;
		pointer-events: auto;
	}

	:global(.app.light) .agent-windows.has-large {
		background: rgba(0, 0, 0, 0.4);
	}

	@media (max-width: 768px) {
		.agent-windows {
			flex-direction: column;
			align-items: stretch;
			padding: 0.375rem;
			gap: 0.375rem;
		}
		.agent-windows.has-large { padding: 0; }
	}
</style>
