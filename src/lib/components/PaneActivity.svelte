<script lang="ts">
	import type { Pane } from '$lib/wsStore.svelte';

	interface Props {
		wsPanes: Map<string, Pane>;
		expandedPanes: Set<string>;
		paneSizes: Record<string, 'compact' | 'medium' | 'large'>;
		panePositions: Record<string, { x: number; y: number }>;
		paneCustomSizes: Record<string, { w: number; h: number }>;
		paneMessageInputs: Record<string, string>;
		draggingPane: string | null;
		resizingPane: string | null;
		onStartDrag: (e: MouseEvent, name: string) => void;
		onStartResize: (e: MouseEvent, name: string) => void;
		onCyclePaneSize: (name: string) => void;
		onRemovePane: (name: string) => void;
		onMinimizePane: (name: string) => void;
		onSendMessage: (name: string, message: string) => void;
		onMouseMove: (e: MouseEvent) => void;
		onMouseUp: () => void;
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
		onStartDrag,
		onStartResize,
		onCyclePaneSize,
		onRemovePane,
		onMinimizePane,
		onSendMessage,
		onMouseMove,
		onMouseUp
	}: Props = $props();

	function getPaneSize(name: string): 'compact' | 'medium' | 'large' {
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

	function handleSubmit(e: Event, paneName: string) {
		e.preventDefault();
		const msg = paneMessageInputs[paneName];
		if (msg?.trim()) {
			onSendMessage(paneName, msg.trim());
			paneMessageInputs[paneName] = '';
		}
	}

	function handleMinimize(name: string) {
		onMinimizePane(name);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="chat-windows"
	class:has-large={Object.values(paneSizes).includes('large')}
	onmousemove={onMouseMove}
	onmouseup={onMouseUp}
	onmouseleave={onMouseUp}
>
	{#each [...wsPanes.values()].filter(p => expandedPanes.has(p.name)) as pane}
		{@const size = getPaneSize(pane.name)}
		{@const customized = isCustomized(pane.name)}
		<div
			class="chat-window {size}"
			class:streaming={pane.streaming}
			class:customized={customized}
			class:dragging={draggingPane === pane.name}
			class:resizing={resizingPane === pane.name}
			data-pane={pane.name}
			style={getPaneStyle(pane.name)}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="chat-window-header" onmousedown={(e) => onStartDrag(e, pane.name)}>
				<div class="chat-window-title">
					<span class="window-indicator" class:active={pane.streaming}></span>
					<span class="window-name">{pane.name}</span>
					<span class="window-type">{pane.pane_type}</span>
				</div>
				<div class="chat-window-actions">
					<button class="window-btn size-btn" onclick={() => onCyclePaneSize(pane.name)} title={size === 'compact' ? 'Expand' : size === 'medium' ? 'Maximize' : 'Compact'}>
						{#if size === 'compact'}
							<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M1 4.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1H2v2.5a.5.5 0 0 1-1 0v-3zm14 0a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0 0 1H14v2.5a.5.5 0 0 0 1 0v-3zm0 7a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1H14V8.5a.5.5 0 0 1 1 0v3zm-14 0a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 0-1H2V8.5a.5.5 0 0 0-1 0v3z"/></svg>
						{:else if size === 'medium'}
							<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M5.828 10.172a.5.5 0 0 0-.707 0l-4.096 4.096V11.5a.5.5 0 0 0-1 0v3.975a.5.5 0 0 0 .5.5H4.5a.5.5 0 0 0 0-1H1.732l4.096-4.096a.5.5 0 0 0 0-.707zm4.344-4.344a.5.5 0 0 0 .707 0l4.096-4.096V4.5a.5.5 0 1 0 1 0V.525a.5.5 0 0 0-.5-.5H11.5a.5.5 0 0 0 0 1h2.768l-4.096 4.096a.5.5 0 0 0 0 .707z"/></svg>
						{:else}
							<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M5.5 0a.5.5 0 0 1 .5.5v4A1.5 1.5 0 0 1 4.5 6h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5zM0 10.5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 6 11.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zm10 1a1.5 1.5 0 0 1 1.5-1.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4z"/></svg>
						{/if}
					</button>
					<button class="window-btn" onclick={() => onRemovePane(pane.name)} title="Remove">×</button>
					<button class="window-btn" onclick={() => handleMinimize(pane.name)} title="Minimize">−</button>
				</div>
			</div>
			<div class="chat-messages">
				{#each pane.messages.slice(size === 'large' ? -100 : size === 'medium' ? -40 : -20) as msg}
					<div class="chat-msg" class:user={msg.role === 'user'} class:assistant={msg.role === 'assistant'} class:tool={msg.role === 'tool'}>
						<span class="msg-role">{msg.role}</span>
						<p class="msg-content">{size === 'large' ? msg.content : msg.content.slice(0, 500)}{size !== 'large' && msg.content.length > 500 ? '...' : ''}</p>
					</div>
				{/each}
				{#if pane.currentDelta}
					<div class="chat-msg assistant streaming">
						<span class="msg-role">assistant</span>
						<p class="msg-content">{size === 'large' ? pane.currentDelta : pane.currentDelta.slice(-300)}<span class="cursor"></span></p>
					</div>
				{/if}
				{#if pane.messages.length === 0 && !pane.currentDelta}
					<div class="chat-empty">No messages yet</div>
				{/if}
			</div>
			<form class="chat-input-form" onsubmit={(e) => handleSubmit(e, pane.name)}>
				<input type="text" value={paneMessageInputs[pane.name] || ''} oninput={(e) => paneMessageInputs[pane.name] = e.currentTarget.value} placeholder="Message..." class="chat-input" />
				<button type="submit" class="chat-send-btn" disabled={!paneMessageInputs[pane.name]?.trim()} aria-label="Send"></button>
			</form>
			<!-- Resize handle -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="resize-handle" onmousedown={(e) => onStartResize(e, pane.name)}>
				<svg viewBox="0 0 10 10" width="10" height="10"><path d="M9 1v8H1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
			</div>
		</div>
	{/each}
</div>

<style>
	.chat-windows {
		display: flex;
		gap: 0.75rem;
		padding: 0 1rem 0.5rem;
		pointer-events: auto;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: flex-end;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.chat-windows.has-large {
		position: fixed;
		inset: 0;
		bottom: auto;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		z-index: 999;
		justify-content: center;
		align-items: center;
	}

	.chat-window {
		position: relative;
		width: 320px;
		max-height: 400px;
		display: flex;
		flex-direction: column;
		background: linear-gradient(
			145deg,
			rgba(38, 38, 42, 0.92) 0%,
			rgba(28, 28, 32, 0.95) 100%
		);
		border: none;
		border-radius: 1rem;
		box-shadow:
			0 0 0 0.5px rgba(255, 255, 255, 0.08),
			0 2px 8px rgba(0, 0, 0, 0.12),
			0 8px 32px rgba(0, 0, 0, 0.24),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
		backdrop-filter: saturate(180%) blur(24px);
		-webkit-backdrop-filter: saturate(180%) blur(24px);
		overflow: hidden;
		transition: transform 200ms ease, box-shadow 200ms ease;
	}

	.chat-window.compact {
		width: 320px;
		max-height: 400px;
	}

	.chat-window.medium {
		width: 480px;
		max-height: 560px;
	}

	.chat-window.medium .chat-messages {
		min-height: 280px;
		max-height: 400px;
	}

	.chat-window.large {
		width: min(90vw, 900px);
		max-height: 85vh;
		border-radius: 1.25rem;
		box-shadow:
			0 0 0 0.5px rgba(255, 255, 255, 0.1),
			0 4px 16px rgba(0, 0, 0, 0.15),
			0 24px 64px rgba(0, 0, 0, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
	}

	.chat-window.large .chat-messages {
		min-height: 400px;
		max-height: calc(85vh - 120px);
	}

	.chat-window.large .chat-window-header {
		padding: 0.875rem 1rem;
	}

	.chat-window.large .window-name {
		font-size: 1rem;
	}

	.chat-window.large .chat-msg {
		padding: 0.75rem 1rem;
		max-width: 85%;
	}

	.chat-window.large .msg-content {
		font-size: 0.875rem;
		line-height: 1.6;
	}

	.chat-window.large .chat-input-form {
		padding: 0.875rem 1rem;
	}

	.chat-window.large .chat-input {
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
	}

	.chat-window.streaming {
		box-shadow:
			0 0 0 1px rgba(245, 158, 11, 0.2),
			0 2px 8px rgba(0, 0, 0, 0.12),
			0 8px 32px rgba(0, 0, 0, 0.24),
			0 0 24px rgba(245, 158, 11, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.chat-window.large.streaming {
		box-shadow:
			0 0 0 1px rgba(245, 158, 11, 0.25),
			0 4px 16px rgba(0, 0, 0, 0.15),
			0 24px 64px rgba(0, 0, 0, 0.35),
			0 0 40px rgba(245, 158, 11, 0.1),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
	}

	:global(.app.light) .chat-window {
		background: linear-gradient(
			145deg,
			rgba(255, 255, 255, 0.95) 0%,
			rgba(248, 248, 250, 0.98) 100%
		);
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.06),
			0 2px 8px rgba(0, 0, 0, 0.06),
			0 8px 32px rgba(0, 0, 0, 0.1),
			inset 0 1px 0 rgba(255, 255, 255, 0.8);
	}

	:global(.app.light) .chat-windows.has-large {
		background: rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(8px);
	}

	:global(.app.light) .chat-window.large {
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.08),
			0 4px 16px rgba(0, 0, 0, 0.08),
			0 24px 64px rgba(0, 0, 0, 0.15),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	.chat-window.customized {
		z-index: 1001;
	}

	.chat-window.dragging,
	.chat-window.resizing {
		transition: none;
	}

	.chat-window.dragging {
		cursor: grabbing;
		transform: scale(1.02);
		box-shadow:
			0 0 0 0.5px rgba(255, 255, 255, 0.1),
			0 8px 24px rgba(0, 0, 0, 0.2),
			0 32px 80px rgba(0, 0, 0, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
		z-index: 1002;
	}

	.chat-window.resizing {
		z-index: 1002;
	}

	:global(.app.light) .chat-window.dragging {
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.08),
			0 8px 24px rgba(0, 0, 0, 0.1),
			0 32px 80px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	.window-btn.size-btn {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.window-btn.size-btn svg {
		opacity: 0.7;
		transition: opacity 0.15s ease;
	}

	.window-btn.size-btn:hover svg {
		opacity: 1;
	}

	.resize-handle {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 16px;
		height: 16px;
		cursor: nwse-resize;
		z-index: 10;
		opacity: 0;
	}

	.resize-handle svg {
		display: none;
	}

	.chat-window-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.625rem 0.5rem 0.875rem;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
		border: none;
		cursor: grab;
		-webkit-user-select: none;
		user-select: none;
	}

	.chat-window.dragging .chat-window-header {
		cursor: grabbing;
	}

	:global(.app.light) .chat-window-header {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, transparent 100%);
	}

	.chat-window-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.window-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-tertiary);
	}

	.window-indicator.active {
		background: #f59e0b;
		box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.window-name {
		font-size: 0.8125rem;
		font-weight: 600;
		font-family: 'JetBrains Mono', monospace;
		color: var(--text-primary);
	}

	.window-type {
		font-size: 0.625rem;
		padding: 0.125rem 0.375rem;
		background: rgba(99, 102, 241, 0.15);
		border-radius: var(--radius-sm);
		color: #6366f1;
		text-transform: uppercase;
	}

	.chat-window-actions {
		display: flex;
		gap: 0.125rem;
	}

	.window-btn {
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.08);
		border: none;
		border-radius: 50%;
		color: var(--text-tertiary);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 120ms ease;
	}

	.window-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		color: var(--text-primary);
	}

	.window-btn:active {
		transform: scale(0.92);
	}

	:global(.app.light) .window-btn {
		background: rgba(0, 0, 0, 0.06);
	}

	:global(.app.light) .window-btn:hover {
		background: rgba(0, 0, 0, 0.1);
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-height: 150px;
		max-height: 250px;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		scroll-behavior: smooth;
	}

	.chat-msg {
		padding: 0.5rem 0.875rem;
		max-width: 85%;
		border: none;
		animation: msgIn 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
	}

	@keyframes msgIn {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.chat-msg.user {
		align-self: flex-end;
		background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
		color: white;
		border-radius: 1.125rem 1.125rem 0.25rem 1.125rem;
		box-shadow: 0 1px 2px rgba(99, 102, 241, 0.3);
	}

	.chat-msg.user .msg-content {
		color: white;
	}

	.chat-msg.assistant {
		align-self: flex-start;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 1.125rem 1.125rem 1.125rem 0.25rem;
	}

	.chat-msg.tool {
		align-self: flex-start;
		background: rgba(245, 158, 11, 0.12);
		border-radius: 0.75rem;
		font-size: 0.6875rem;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		padding: 0.375rem 0.625rem;
		max-width: 95%;
	}

	.chat-msg.tool .msg-content {
		font-size: inherit;
		font-family: inherit;
		opacity: 0.9;
	}

	.chat-msg.streaming {
		background: rgba(245, 158, 11, 0.15);
	}

	:global(.app.light) .chat-msg.user {
		background: linear-gradient(135deg, #007aff 0%, #0056b3 100%);
	}

	:global(.app.light) .chat-msg.assistant {
		background: rgba(0, 0, 0, 0.05);
	}

	.msg-role {
		display: none;
	}

	.msg-content {
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--text-primary);
		word-break: break-word;
		white-space: pre-wrap;
	}

	.cursor {
		display: inline-block;
		width: 2px;
		height: 1em;
		background: #f59e0b;
		animation: blink 0.8s step-end infinite;
		vertical-align: text-bottom;
		margin-left: 2px;
	}

	@keyframes blink {
		50% { opacity: 0; }
	}

	.chat-empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: var(--text-tertiary);
		font-size: 0.8125rem;
		padding: 2rem;
	}

	.chat-empty::before {
		content: '💬';
		font-size: 2rem;
		opacity: 0.4;
	}

	.chat-input-form {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.05) 100%);
		border: none;
	}

	:global(.app.light) .chat-input-form {
		background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.02) 100%);
	}

	.chat-input {
		flex: 1;
		padding: 0.625rem 1rem;
		font-size: 0.875rem;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
		background: rgba(255, 255, 255, 0.08);
		border: none;
		border-radius: 1.25rem;
		color: var(--text-primary);
		transition: background 150ms ease;
	}

	.chat-input:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.12);
	}

	.chat-input::placeholder {
		color: var(--text-tertiary);
	}

	:global(.app.light) .chat-input {
		background: rgba(0, 0, 0, 0.05);
	}

	:global(.app.light) .chat-input:focus {
		background: rgba(0, 0, 0, 0.08);
	}

	.chat-send-btn {
		width: 2rem;
		height: 2rem;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		background: #6366f1;
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
		flex-shrink: 0;
	}

	.chat-send-btn::after {
		content: '↑';
		font-weight: 700;
		font-size: 0.875rem;
	}

	.chat-send-btn:hover:not(:disabled) {
		background: #4f46e5;
		transform: scale(1.05);
	}

	.chat-send-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.chat-send-btn:disabled {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-tertiary);
		cursor: default;
	}

	:global(.app.light) .chat-send-btn {
		background: #007aff;
	}

	:global(.app.light) .chat-send-btn:hover:not(:disabled) {
		background: #0056b3;
	}

	:global(.app.light) .chat-send-btn:disabled {
		background: rgba(0, 0, 0, 0.08);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	@media (max-width: 768px) {
		.chat-windows {
			flex-direction: column;
			align-items: stretch;
			padding: 0.5rem;
			gap: 0.5rem;
		}

		.chat-windows.has-large {
			padding: 0;
			background: rgba(0, 0, 0, 0.85);
		}

		.chat-window {
			width: 100%;
			max-width: none;
			border-radius: var(--radius-xl);
		}

		.chat-window.large {
			width: 100%;
			max-height: 100vh;
			border-radius: 0;
		}

		.chat-window.large .chat-messages {
			max-height: calc(100vh - 140px);
			min-height: 60vh;
		}

		.chat-window-header {
			padding: 0.75rem 1rem;
			padding-top: max(0.75rem, env(safe-area-inset-top));
		}

		.chat-messages {
			padding: 0.875rem;
		}

		.chat-msg {
			max-width: 80%;
		}

		.chat-input-form {
			padding: 0.625rem 0.75rem;
			padding-bottom: max(0.625rem, env(safe-area-inset-bottom));
		}

		.chat-input {
			padding: 0.75rem 1rem;
			font-size: 1rem;
			min-height: 2.75rem;
		}

		.chat-send-btn {
			width: 2.5rem;
			height: 2.5rem;
		}

		.chat-send-btn::after {
			font-size: 1rem;
		}
	}
</style>
