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

<aside class="manager-pane" class:streaming={session.streaming}>
	<header class="manager-header">
		<div class="manager-title">
			<span class="manager-dot" class:live={session.streaming}></span>
			<span class="manager-label">Manager</span>
		</div>
		<div class="manager-actions">
			{#if session.usage}
				<span class="manager-usage">
					{((session.usage.inputTokens + session.usage.outputTokens) / 1000).toFixed(0)}k
				</span>
			{/if}
			<button
				class="manager-minimize"
				onclick={toggleManagerVisibility}
				title="Minimize manager"
			>
				<svg viewBox="0 0 10 10" width="10" height="10">
					<path d="M2 5h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
			</button>
		</div>
	</header>

	<div class="manager-messages">
		<AgentMessageList
			pane={session}
			size="medium"
			toolsExpandedByDefault={false}
			firstUnreadIndex={null}
			bind:messagesRef
		/>
	</div>

	<div class="manager-input">
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
</aside>

<style>
	.manager-pane {
		position: fixed;
		right: 0;
		top: 0;
		bottom: 48px;
		width: 400px;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
		border-left: 2px solid rgba(245, 158, 11, 0.35);
		z-index: 900;
		animation: slideIn 200ms ease-out;
	}

	@keyframes slideIn {
		from { transform: translateX(100%); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}

	.manager-pane.streaming {
		border-left-color: rgba(245, 158, 11, 0.6);
		animation: slideIn 200ms ease-out, managerPulse 2s ease-in-out infinite;
	}

	@keyframes managerPulse {
		0%, 100% { border-left-color: rgba(245, 158, 11, 0.6); }
		50% { border-left-color: rgba(245, 158, 11, 0.3); }
	}

	.manager-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		border-bottom: 1px solid rgba(245, 158, 11, 0.15);
		background: rgba(245, 158, 11, 0.04);
		flex-shrink: 0;
	}

	.manager-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.manager-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(245, 158, 11, 0.4);
		flex-shrink: 0;
	}

	.manager-dot.live {
		background: #f59e0b;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.manager-label {
		font: 600 11px/1 system-ui, -apple-system, sans-serif;
		color: #f59e0b;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.manager-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.manager-usage {
		font: 500 9px/1 'IBM Plex Mono', ui-monospace, monospace;
		color: var(--text-tertiary);
		background: rgba(245, 158, 11, 0.08);
		padding: 2px 6px;
		border-radius: 4px;
	}

	.manager-minimize {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all 80ms ease;
	}

	.manager-minimize:hover {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	.manager-messages {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}

	.manager-input {
		flex-shrink: 0;
		border-top: 1px solid rgba(245, 158, 11, 0.15);
		padding: 0.5rem;
	}

	:global(.app.light) .manager-pane {
		border-left-color: rgba(217, 119, 6, 0.3);
	}

	:global(.app.light) .manager-header {
		background: rgba(245, 158, 11, 0.06);
		border-bottom-color: rgba(217, 119, 6, 0.12);
	}

	:global(.app.light) .manager-minimize:hover {
		background: rgba(217, 119, 6, 0.12);
		color: #d97706;
	}
</style>
