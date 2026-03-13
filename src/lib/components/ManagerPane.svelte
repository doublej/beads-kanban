<script lang="ts">
	import type { Pane } from '$lib/wsStore.svelte';
	import AgentMessageList from './AgentMessageList.svelte';
	import AgentPaneInput from './AgentPaneInput.svelte';
	import { MANAGER_SESSION_NAME, toggleManagerVisibility } from '$lib/stores/manager.svelte';

	interface Props {
		session: Pane;
		onSendMessage: (name: string, message: string) => void;
		onInterrupt?: (name: string) => void;
		disabled: boolean;
	}

	let {
		session,
		onSendMessage,
		onInterrupt,
		disabled,
	}: Props = $props();

	let messageInput = $state('');
	let messagesRef = $state<HTMLDivElement | null>(null);
	let inputRef = $state<HTMLInputElement | null>(null);

	function handleInputChange(value: string) {
		messageInput = value;
	}
</script>

<section class="column" class:streaming={session.streaming}>
	<header class="column-header">
		<div class="column-title">
			<span class="live-dot" class:active={session.streaming}></span>
			<h2>Manager</h2>
			{#if session.usage}
				<span class="column-count">
					{((session.usage.inputTokens + session.usage.outputTokens) / 1000).toFixed(0)}k
				</span>
			{/if}
		</div>
		<div class="column-header-actions">
			<button
				class="column-collapse-btn"
				onclick={toggleManagerVisibility}
				title="Minimize manager"
			>
				<svg viewBox="0 0 10 10" width="10" height="10">
					<path d="M2 5h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
			</button>
		</div>
	</header>

	<div class="cards">
		<AgentMessageList
			pane={session}
			size="medium"
			toolsExpandedByDefault={false}
			firstUnreadIndex={null}
			bind:messagesRef
		/>
	</div>

	<div class="input-area">
		<AgentPaneInput
			pane={session}
			bind:messageInput
			{disabled}
			bind:inputRef
			{onSendMessage}
			onInputChange={handleInputChange}
			{onInterrupt}
		/>
	</div>
</section>

<style>
	.column {
		flex: 0 0 400px;
		min-width: 320px;
		max-width: 480px;
		min-height: 0;
		align-self: stretch;
		display: flex;
		flex-direction: column;
		background: var(--surface-panel);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: border-color var(--transition-fast);
		animation: slideIn 200ms ease-out;
		/* Match board padding: top/bottom 1.25rem, right 1.25rem; left gap comes from board */
		margin: 1.25rem 1.25rem 1.25rem 0;
	}

	@keyframes slideIn {
		from { transform: translateX(20px); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}

	.column.streaming {
		border-color: rgba(245, 158, 11, 0.4);
	}

	.column-header {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--surface-card);
	}

	.column-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.column-title h2 {
		font: 600 11px/1 var(--font-sans);
		color: #f59e0b;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin: 0;
	}

	.live-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(245, 158, 11, 0.3);
		flex-shrink: 0;
	}

	.live-dot.active {
		background: #f59e0b;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.column-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.125rem;
		padding: 0 0.375rem;
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
		border-radius: var(--radius-xs);
		font: 600 10px/1 var(--font-mono);
	}

	.column-header-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.column-collapse-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.column-collapse-btn:hover {
		background: var(--surface-elevated);
		color: var(--text-primary);
	}

	.cards {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		min-height: 0;
	}

	.cards::-webkit-scrollbar {
		width: 4px;
	}

	.cards::-webkit-scrollbar-track {
		background: transparent;
	}

	.cards::-webkit-scrollbar-thumb {
		background: var(--border-subtle);
		border-radius: 2px;
	}

	.cards::-webkit-scrollbar-thumb:hover {
		background: var(--border-default);
	}

	.input-area {
		flex-shrink: 0;
		border-top: 1px solid var(--border-subtle);
		padding: 0.5rem;
	}

	:global(.app.light) .column {
		box-shadow: var(--shadow-sm);
	}

	:global(.app.light) .column.streaming {
		border-color: rgba(217, 119, 6, 0.35);
	}
</style>
