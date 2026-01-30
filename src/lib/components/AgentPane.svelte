<script lang="ts">
	import type { Pane, SdkSessionInfo } from '$lib/wsStore.svelte';
	import AgentPaneHeader from './AgentPaneHeader.svelte';
	import AgentMessageList from './AgentMessageList.svelte';
	import AgentPaneInput from './AgentPaneInput.svelte';

	interface Props {
		pane: Pane;
		size: 'compact' | 'medium' | 'large';
		customized: boolean;
		isDragging: boolean;
		isResizing: boolean;
		isActive: boolean;
		style: string;
		messageInput: string;
		disabled: boolean;
		toolsExpandedByDefault: boolean;
		firstUnreadIndex: number | null;
		isMenuOpen: boolean;
		isAutoscrollEnabled: boolean;
		messagesRef: HTMLDivElement | null;
		inputRef: HTMLInputElement | null;
		onSetActive: () => void;
		onStartDrag: (e: MouseEvent) => void;
		onStartResize: (e: MouseEvent, edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => void;
		onRemovePane: (name: string) => void;
		onMinimizePane: (name: string) => void;
		onCyclePaneSize: (name: string) => void;
		onSendMessage: (name: string, message: string) => void;
		onInputChange: (value: string) => void;
		onToggleMenu: () => void;
		onCloseMenu: () => void;
		onToggleAutoscroll: () => void;
		onOpenTicket?: (ticketId: string) => void;
		onEndSession?: (name: string) => void;
		onClearSession?: (name: string) => void;
		onContinueSession?: (name: string) => void;
		onCompactSession?: (name: string) => void;
		onFetchSessions?: () => Promise<SdkSessionInfo[]>;
		onOpenSessionPicker: () => void;
	}

	let {
		pane,
		size,
		customized,
		isDragging,
		isResizing,
		isActive,
		style,
		messageInput = $bindable(),
		disabled,
		toolsExpandedByDefault,
		firstUnreadIndex,
		isMenuOpen,
		isAutoscrollEnabled,
		messagesRef = $bindable(),
		inputRef = $bindable(),
		onSetActive,
		onStartDrag,
		onStartResize,
		onRemovePane,
		onMinimizePane,
		onCyclePaneSize,
		onSendMessage,
		onInputChange,
		onToggleMenu,
		onCloseMenu,
		onToggleAutoscroll,
		onOpenTicket,
		onEndSession,
		onClearSession,
		onContinueSession,
		onCompactSession,
		onFetchSessions,
		onOpenSessionPicker
	}: Props = $props();

	function getTicketIdFromPaneName(name: string): string | null {
		return name.endsWith('-agent') ? name.slice(0, -6) : null;
	}

	let ticketId = $derived(getTicketIdFromPaneName(pane.name));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="agent-window {size}"
	class:streaming={pane.streaming}
	class:customized
	class:dragging={isDragging}
	class:resizing={isResizing}
	class:active={isActive}
	data-pane={pane.name}
	{style}
	onclick={onSetActive}
>
	<AgentPaneHeader
		{pane}
		{ticketId}
		{isMenuOpen}
		{isAutoscrollEnabled}
		onStartDrag={(e) => onStartDrag(e)}
		{onRemovePane}
		{onMinimizePane}
		{onCyclePaneSize}
		{onToggleMenu}
		{onCloseMenu}
		{onToggleAutoscroll}
		{onOpenTicket}
		{onContinueSession}
		{onCompactSession}
		{onEndSession}
		{onClearSession}
		{onFetchSessions}
		{onOpenSessionPicker}
	/>

	<AgentMessageList
		{pane}
		{size}
		{toolsExpandedByDefault}
		{firstUnreadIndex}
		bind:messagesRef
	/>

	<AgentPaneInput
		{pane}
		bind:messageInput
		{disabled}
		bind:inputRef
		{onSendMessage}
		{onInputChange}
	/>

	<!-- Resize handles -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="resize-edge top" onmousedown={(e) => onStartResize(e, 'n')}></div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="resize-edge right" onmousedown={(e) => onStartResize(e, 'e')}></div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="resize-edge bottom" onmousedown={(e) => onStartResize(e, 's')}></div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="resize-edge left" onmousedown={(e) => onStartResize(e, 'w')}></div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="resize-corner nw" onmousedown={(e) => onStartResize(e, 'nw')}></div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="resize-corner ne" onmousedown={(e) => onStartResize(e, 'ne')}></div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="resize-corner sw" onmousedown={(e) => onStartResize(e, 'sw')}></div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="resize-corner se" onmousedown={(e) => onStartResize(e, 'se')}>
		<svg viewBox="0 0 8 8" width="8" height="8">
			<path d="M7 1v6H1" stroke="currentColor" stroke-width="1" fill="none" opacity="0.5"/>
			<path d="M7 4v3H4" stroke="currentColor" stroke-width="1" fill="none" opacity="0.3"/>
		</svg>
	</div>
</div>

<style>
	.agent-window {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--bg-secondary, rgba(24, 24, 28, 0.98));
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
		border-radius: 6px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		min-width: 280px;
		min-height: 200px;
		pointer-events: auto;
	}

	.agent-window.compact { width: 340px; height: 320px; }
	.agent-window.medium { width: 520px; height: 480px; }
	.agent-window.large { width: min(95vw, 1000px); height: min(90vh, 800px); }
	.agent-window.customized { z-index: 1001; }

	.agent-window.streaming {
		border-color: rgba(99, 102, 241, 0.35);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.15);
		animation: streamPulse 2s ease-in-out infinite;
	}

	@keyframes streamPulse {
		0%, 100% { border-color: rgba(99, 102, 241, 0.25); }
		50% { border-color: rgba(99, 102, 241, 0.45); }
	}

	.agent-window.dragging {
		cursor: grabbing; opacity: 0.95;
		box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
		z-index: 1002; transition: none;
		will-change: transform, left, top;
		contain: layout style;
		pointer-events: none;
	}

	.agent-window.resizing {
		z-index: 1002; transition: none;
		will-change: width, height; contain: layout style;
	}

	.agent-window.active {
		border-color: rgba(99, 102, 241, 0.5);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.25);
		z-index: 1000;
	}

	.agent-window.active.streaming {
		border-color: rgba(99, 102, 241, 0.5);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.25);
	}

	:global(.app.light) .agent-window {
		background: rgba(255, 255, 255, 0.98);
		border-color: rgba(0, 0, 0, 0.1);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
	}

	:global(.app.light) .agent-window.active {
		border-color: rgba(99, 102, 241, 0.6);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(99, 102, 241, 0.3);
	}

	/* Resize handles */
	.resize-corner { position: absolute; width: 12px; height: 12px; z-index: 10; }
	.resize-corner.nw { top: 0; left: 0; cursor: nwse-resize; }
	.resize-corner.ne { top: 0; right: 0; cursor: nesw-resize; }
	.resize-corner.sw { bottom: 0; left: 0; cursor: nesw-resize; }
	.resize-corner.se {
		bottom: 0; right: 0; cursor: nwse-resize;
		display: flex; align-items: flex-end; justify-content: flex-end;
		padding: 2px; color: var(--text-tertiary);
		opacity: 0.4; transition: opacity 100ms ease;
	}
	.resize-corner.se:hover { opacity: 0.8; }

	.resize-edge { position: absolute; z-index: 9; }
	.resize-edge.top { top: 0; left: 12px; right: 12px; height: 4px; cursor: ns-resize; }
	.resize-edge.right { top: 12px; right: 0; width: 4px; bottom: 12px; cursor: ew-resize; }
	.resize-edge.bottom { left: 12px; bottom: 0; height: 4px; right: 12px; cursor: ns-resize; }
	.resize-edge.left { top: 12px; left: 0; width: 4px; bottom: 12px; cursor: ew-resize; }

	@media (max-width: 768px) {
		.agent-window { width: 100% !important; min-width: auto; }
		.agent-window.compact { height: 280px; }
		.agent-window.large { height: 100vh; border-radius: 0; }
	}
</style>
