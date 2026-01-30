<script lang="ts">
	import type { Pane, ChatMessage } from '$lib/wsStore.svelte';
	import MarkdownContent from './MarkdownContent.svelte';

	interface Props {
		pane: Pane;
		size: 'compact' | 'medium' | 'large';
		toolsExpandedByDefault: boolean;
		firstUnreadIndex: number | null;
		messagesRef: HTMLDivElement | null;
	}

	let {
		pane,
		size,
		toolsExpandedByDefault,
		firstUnreadIndex,
		messagesRef = $bindable()
	}: Props = $props();

	let collapsedTools = $state<Set<string>>(new Set());

	function toggleToolCollapse(key: string) {
		if (collapsedTools.has(key)) {
			collapsedTools.delete(key);
		} else {
			collapsedTools.add(key);
		}
		collapsedTools = new Set(collapsedTools);
	}

	function getSliceSize(): number {
		return size === 'large' ? 200 : size === 'medium' ? 80 : 40;
	}

	function isToolCollapsed(key: string): boolean {
		return toolsExpandedByDefault ? collapsedTools.has(key) : !collapsedTools.has(key);
	}
</script>

<div class="messages" bind:this={messagesRef}>
	{#each pane.messages.slice(-getSliceSize()) as msg, i}
		{@const toolKey = `${pane.name}-${i}`}
		{@const isCollapsed = msg.role === 'tool' && isToolCollapsed(toolKey)}
		{@const isUnread = firstUnreadIndex !== null && i >= firstUnreadIndex}
		{#if firstUnreadIndex !== null && i === firstUnreadIndex}
			<div class="new-messages-marker">
				<span class="marker-line"></span>
				<span class="marker-label">new</span>
				<span class="marker-line"></span>
			</div>
		{/if}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="msg {msg.role} {msg.role === 'notification' ? msg.notificationType || '' : ''} {msg.role === 'system' ? msg.systemSubtype || '' : ''}"
			class:collapsed={isCollapsed}
			class:clickable={msg.role === 'tool'}
			class:unread={isUnread}
			onclick={msg.role === 'tool' ? () => toggleToolCollapse(toolKey) : undefined}
		>
			{#if msg.role === 'tool'}
				<span class="collapse-icon">
					{#if isCollapsed}
						<svg viewBox="0 0 8 8" width="8" height="8"><path d="M2 1l4 3-4 3z" fill="currentColor"/></svg>
					{:else}
						<svg viewBox="0 0 8 8" width="8" height="8"><path d="M1 2l3 4 3-4z" fill="currentColor"/></svg>
					{/if}
				</span>
			{:else if msg.role === 'system'}
				<span class="system-icon {msg.systemSubtype || ''}">
					{#if msg.systemSubtype === 'compact_start' || msg.systemSubtype === 'compact_done'}
						<svg viewBox="0 0 16 16" width="10" height="10"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 3a5 5 0 010 10" fill="currentColor"/></svg>
					{:else if msg.systemSubtype === 'subagent_start'}
						<svg viewBox="0 0 16 16" width="10" height="10"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
					{:else if msg.systemSubtype === 'subagent_end'}
						<svg viewBox="0 0 16 16" width="10" height="10"><circle cx="8" cy="8" r="5" fill="currentColor" opacity="0.8"/></svg>
					{:else}
						<svg viewBox="0 0 16 16" width="10" height="10"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>
					{/if}
				</span>
			{:else if msg.role === 'notification'}
				<span class="notification-icon {msg.notificationType || ''}">
					{#if msg.notificationType === 'comment'}
						<svg viewBox="0 0 16 16" width="10" height="10"><path d="M2.5 3A1.5 1.5 0 014 1.5h8A1.5 1.5 0 0113.5 3v7a1.5 1.5 0 01-1.5 1.5H6l-3.5 3V3z" fill="currentColor"/></svg>
					{:else if msg.notificationType === 'dependency'}
						<svg viewBox="0 0 16 16" width="10" height="10"><path d="M4 8h8M8 4v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
					{:else if msg.notificationType === 'attachment'}
						<svg viewBox="0 0 16 16" width="10" height="10"><path d="M10.5 3.5l-6 6a2.12 2.12 0 003 3l6-6a3.54 3.54 0 00-5-5l-6 6a4.95 4.95 0 007 7l6-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
					{:else if msg.notificationType === 'status'}
						<svg viewBox="0 0 16 16" width="10" height="10"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>
					{:else if msg.notificationType === 'priority'}
						<svg viewBox="0 0 16 16" width="10" height="10"><path d="M8 2l2 4 4.5.6-3.3 3.2.8 4.5L8 12l-4 2.3.8-4.5L1.5 6.6 6 6l2-4z" fill="currentColor"/></svg>
					{:else}
						<svg viewBox="0 0 16 16" width="10" height="10"><circle cx="8" cy="8" r="3" fill="currentColor"/></svg>
					{/if}
				</span>
			{:else}
				<span class="role-tag">{msg.role === 'user' ? '>' : '<'}</span>
			{/if}
			{#if msg.role === 'tool'}
				{#if isCollapsed}
					<pre class="content collapsed-preview"><span class="tool-name">{msg.toolName || 'tool'}</span>{#if msg.toolResult}<span class="tool-status done">&#10003;</span>{:else}<span class="tool-status pending">…</span>{/if}</pre>
				{:else}
					<div class="tool-details">
						<div class="tool-header">{msg.toolName || 'tool'}</div>
						{#if msg.toolInput}
							<div class="tool-section">
								<span class="tool-label">Input:</span>
								<pre class="tool-json">{JSON.stringify(msg.toolInput, null, 2)}</pre>
							</div>
						{/if}
						{#if msg.toolResult}
							<div class="tool-section">
								<span class="tool-label">Result:</span>
								<pre class="tool-result">{msg.toolResult.slice(0, size === 'large' ? 10000 : 2000)}{msg.toolResult.length > (size === 'large' ? 10000 : 2000) ? '…' : ''}</pre>
							</div>
						{:else}
							<div class="tool-section tool-pending">
								<span class="tool-label">Executing...</span>
							</div>
						{/if}
					</div>
				{/if}
			{:else if msg.role === 'notification'}
				<div class="notification-content {msg.notificationType || ''}">
					{msg.content}
				</div>
			{:else if msg.role === 'system'}
				<div class="system-content {msg.systemSubtype || ''}">
					{msg.content}
				</div>
			{:else}
				<div class="content">
					<MarkdownContent content={msg.content} maxLength={size === 'large' ? undefined : 3000} />
				</div>
			{/if}
		</div>
	{/each}
	{#if pane.currentDelta}
		<div class="msg assistant streaming">
			<span class="role-tag">&lt;</span>
			<div class="content streaming-content">
				<MarkdownContent content={pane.currentDelta} />
				<span class="cursor"></span>
			</div>
		</div>
	{/if}
	{#if pane.messages.length === 0 && !pane.currentDelta}
		<div class="empty-state">awaiting input</div>
	{/if}
</div>

<style>
	.messages {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 0.375rem;
		display: flex;
		flex-direction: column;
		gap: 1px;
		font: 11px/1.35 'IBM Plex Mono', ui-monospace, monospace;
		overscroll-behavior: contain;
	}

	.messages::-webkit-scrollbar { width: 6px; }
	.messages::-webkit-scrollbar-track { background: transparent; }
	.messages::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 3px; }
	.messages::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }

	:global(.app.light) .messages::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); }
	:global(.app.light) .messages::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.2); }

	/* New messages marker */
	.new-messages-marker { display: flex; align-items: center; gap: 0.5rem; margin: 0.25rem 0; opacity: 0.9; }
	.marker-line { flex: 1; height: 1px; background: rgba(239, 68, 68, 0.4); }
	.marker-label {
		font: 600 8px/1 'IBM Plex Mono', ui-monospace, monospace;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #ef4444;
		padding: 2px 6px;
		background: rgba(239, 68, 68, 0.1);
		border-radius: 3px;
	}

	:global(.app.light) .marker-line { background: rgba(239, 68, 68, 0.35); }
	:global(.app.light) .marker-label { background: rgba(239, 68, 68, 0.08); color: #dc2626; }

	.msg.unread { border-left: 2px solid rgba(239, 68, 68, 0.5); padding-left: calc(0.375rem - 2px); margin-left: 2px; }

	.msg {
		display: flex;
		gap: 0.375rem;
		padding: 0.25rem 0.375rem;
		border-radius: 3px;
		animation: fadeIn 150ms ease;
		min-width: 0;
	}

	@keyframes fadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }

	.msg.user { background: rgba(99, 102, 241, 0.12); }
	.msg.assistant { background: rgba(255, 255, 255, 0.03); }
	.msg.tool { background: rgba(34, 211, 238, 0.06); opacity: 0.8; }
	.msg.streaming { background: rgba(99, 102, 241, 0.08); }

	:global(.app.light) .msg.user { background: rgba(99, 102, 241, 0.1); }
	:global(.app.light) .msg.assistant { background: rgba(0, 0, 0, 0.03); }
	:global(.app.light) .msg.tool { background: rgba(34, 211, 238, 0.06); }

	/* Notification styles */
	.msg.notification { background: rgba(251, 191, 36, 0.08); border-left: 2px solid rgba(251, 191, 36, 0.4); padding-left: 0.5rem; }
	.msg.notification.comment { background: rgba(59, 130, 246, 0.08); border-left-color: rgba(59, 130, 246, 0.4); }
	.msg.notification.dependency { background: rgba(168, 85, 247, 0.08); border-left-color: rgba(168, 85, 247, 0.4); }
	.msg.notification.attachment { background: rgba(34, 197, 94, 0.08); border-left-color: rgba(34, 197, 94, 0.4); }
	.msg.notification.status { background: rgba(251, 146, 60, 0.08); border-left-color: rgba(251, 146, 60, 0.4); }
	.msg.notification.priority { background: rgba(239, 68, 68, 0.08); border-left-color: rgba(239, 68, 68, 0.4); }
	.msg.notification.assignee { background: rgba(99, 102, 241, 0.08); border-left-color: rgba(99, 102, 241, 0.4); }
	.msg.notification.label { background: rgba(14, 165, 233, 0.08); border-left-color: rgba(14, 165, 233, 0.4); }

	:global(.app.light) .msg.notification { background: rgba(251, 191, 36, 0.06); }
	:global(.app.light) .msg.notification.comment { background: rgba(59, 130, 246, 0.06); }
	:global(.app.light) .msg.notification.dependency { background: rgba(168, 85, 247, 0.06); }
	:global(.app.light) .msg.notification.attachment { background: rgba(34, 197, 94, 0.06); }
	:global(.app.light) .msg.notification.status { background: rgba(251, 146, 60, 0.06); }
	:global(.app.light) .msg.notification.priority { background: rgba(239, 68, 68, 0.06); }
	:global(.app.light) .msg.notification.assignee { background: rgba(99, 102, 241, 0.06); }
	:global(.app.light) .msg.notification.label { background: rgba(14, 165, 233, 0.06); }

	.notification-icon {
		display: flex; align-items: center; justify-content: center;
		width: 14px; height: 14px; flex-shrink: 0; color: #fbbf24;
	}
	.notification-icon.comment { color: #3b82f6; }
	.notification-icon.dependency { color: #a855f7; }
	.notification-icon.attachment { color: #22c55e; }
	.notification-icon.status { color: #fb923c; }
	.notification-icon.priority { color: #ef4444; }
	.notification-icon.assignee { color: #6366f1; }
	.notification-icon.label { color: #0ea5e9; }

	.notification-content {
		flex: 1;
		font: 10px/1.35 'IBM Plex Mono', ui-monospace, monospace;
		color: var(--text-secondary, #aaa);
		font-style: italic;
	}
	.notification-content.comment { color: #60a5fa; }
	.notification-content.dependency { color: #c084fc; }
	.notification-content.attachment { color: #4ade80; }
	.notification-content.status { color: #fdba74; }
	.notification-content.priority { color: #fca5a5; }
	.notification-content.assignee { color: #a5b4fc; }
	.notification-content.label { color: #38bdf8; }

	/* System message styles */
	.msg.system { background: rgba(16, 185, 129, 0.06); border-left: 2px solid rgba(16, 185, 129, 0.3); padding-left: 0.5rem; }
	.msg.system.compact_start { background: rgba(251, 191, 36, 0.08); border-left-color: rgba(251, 191, 36, 0.4); }
	.msg.system.compact_done { background: rgba(16, 185, 129, 0.08); border-left-color: rgba(16, 185, 129, 0.4); }
	.msg.system.subagent_start { background: rgba(99, 102, 241, 0.08); border-left-color: rgba(99, 102, 241, 0.4); }
	.msg.system.subagent_end { background: rgba(99, 102, 241, 0.06); border-left-color: rgba(99, 102, 241, 0.3); }

	:global(.app.light) .msg.system { background: rgba(16, 185, 129, 0.04); }
	:global(.app.light) .msg.system.compact_start { background: rgba(251, 191, 36, 0.06); }
	:global(.app.light) .msg.system.compact_done { background: rgba(16, 185, 129, 0.06); }
	:global(.app.light) .msg.system.subagent_start { background: rgba(99, 102, 241, 0.06); }
	:global(.app.light) .msg.system.subagent_end { background: rgba(99, 102, 241, 0.04); }

	.system-icon {
		display: flex; align-items: center; justify-content: center;
		width: 14px; height: 14px; flex-shrink: 0; color: #10b981;
	}
	.system-icon.compact_start { color: #fbbf24; }
	.system-icon.compact_done { color: #10b981; }
	.system-icon.subagent_start { color: #6366f1; }
	.system-icon.subagent_end { color: #818cf8; }

	.system-content {
		flex: 1;
		font: 10px/1.35 'IBM Plex Mono', ui-monospace, monospace;
		color: var(--text-secondary, #aaa);
		font-style: italic;
	}
	.system-content.compact_start { color: #fbbf24; }
	.system-content.compact_done { color: #10b981; }
	.system-content.subagent_start { color: #818cf8; }
	.system-content.subagent_end { color: #a5b4fc; }

	.role-tag { color: var(--text-tertiary); flex-shrink: 0; width: 1ch; user-select: none; }
	.msg.user .role-tag { color: #6366f1; }
	.msg.tool .role-tag { color: #22d3ee; }

	/* Clickable tool messages */
	.msg.clickable { cursor: pointer; transition: background 100ms ease; }
	.msg.clickable:hover { background: rgba(34, 211, 238, 0.08); }

	.collapse-icon {
		width: 8px; height: 8px; color: #22d3ee; flex-shrink: 0;
		opacity: 0.7; transition: opacity 80ms ease;
		display: flex; align-items: center; justify-content: center;
	}
	.msg.clickable:hover .collapse-icon { opacity: 1; }
	.msg.collapsed { opacity: 0.7; }
	.msg.collapsed:hover { opacity: 1; }
	.collapsed-preview { font-style: italic; opacity: 0.7; }
	.tool-name { color: #22d3ee; font-weight: 500; }
	.tool-status { margin-left: 6px; font-size: 10px; }
	.tool-status.done { color: #22c55e; }
	.tool-status.pending { color: var(--text-tertiary); animation: toolPending 1s ease-in-out infinite; }

	@keyframes toolPending { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

	.tool-details { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
	.tool-header { color: #22d3ee; font-weight: 600; font-size: 11px; }
	.tool-section { display: flex; flex-direction: column; gap: 2px; }
	.tool-label { color: var(--text-tertiary); font-size: 9px; text-transform: uppercase; letter-spacing: 0.03em; }

	.tool-json, .tool-result {
		margin: 0;
		font-size: 9px; line-height: 1.3;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		color: var(--text-secondary, #aaa);
		white-space: pre-wrap; word-break: break-word;
		background: rgba(0, 0, 0, 0.2);
		padding: 0.25rem 0.375rem;
		border-radius: 3px;
		max-height: 200px; overflow-y: auto;
	}

	:global(.app.light) .tool-json, :global(.app.light) .tool-result { background: rgba(0, 0, 0, 0.04); }

	.tool-pending .tool-label { color: #22d3ee; opacity: 0.7; animation: pulse 1.2s ease-in-out infinite; }

	.content {
		flex: 1; margin: 0; color: var(--text-primary);
		word-break: break-word; font: inherit; min-width: 0; overflow: hidden;
	}

	.streaming-content { display: flex; align-items: flex-end; gap: 2px; }

	.cursor {
		display: inline-block; width: 1px; height: 1em;
		background: #6366f1; animation: blink 0.6s step-end infinite;
		vertical-align: text-bottom; margin-left: 1px;
	}

	@keyframes blink { 50% { opacity: 0; } }

	.empty-state {
		flex: 1; display: flex; align-items: center; justify-content: center;
		color: var(--text-tertiary); font: italic 11px/1 'IBM Plex Mono', monospace; opacity: 0.6;
	}

	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

	@media (max-width: 768px) {
		.messages { padding: 0.5rem; }
	}
</style>
