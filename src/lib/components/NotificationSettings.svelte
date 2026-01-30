<script lang="ts">
	import { settings } from '$lib/stores/settings.svelte';
	import type { NotificationEventType } from '$lib/notifications/types';
	import McpStatusIndicator from './McpStatusIndicator.svelte';

	const eventLabels: Record<NotificationEventType, { label: string; desc: string }> = {
		blocked: { label: 'Issue Blocked', desc: 'When issue status changes to blocked' },
		unblocked: { label: 'Issue Unblocked', desc: 'When blocked issue becomes unblocked' },
		status_changed: { label: 'Status Changed', desc: 'Any status transition' },
		priority_changed: { label: 'Priority Changed', desc: 'Issue priority updates' },
		assignee_changed: { label: 'Assignee Changed', desc: 'Assignment updates' },
		comment_added: { label: 'Comment Added', desc: 'New comments posted' },
		dependency_added: { label: 'Dependency Added', desc: 'New dependencies created' },
		label_modified: { label: 'Labels Modified', desc: 'Labels added or removed' },
		attachment_added: { label: 'Attachment Added', desc: 'File attachments uploaded' },
		issue_created: { label: 'Issue Created', desc: 'New issues created' },
		issue_closed: { label: 'Issue Closed', desc: 'Issues closed or deleted' }
	};

	function toggleEvent(event: NotificationEventType) {
		settings.notificationEvents = {
			...settings.notificationEvents,
			[event]: !settings.notificationEvents[event]
		};
	}
</script>

<section class="settings-section">
	<h3 class="section-label">Notifications</h3>

	<div class="setting-row">
		<div class="setting-info">
			<span class="setting-name">Notification Mode</span>
			<span class="setting-desc">How notifications are delivered</span>
		</div>
	</div>

	<div class="mode-selector">
		<button
			class="mode-option"
			class:active={settings.notificationMode === 'none'}
			onclick={() => settings.notificationMode = 'none'}
		>
			<span class="mode-name">None</span>
			<span class="mode-desc">Disable all notifications</span>
		</button>
		<button
			class="mode-option"
			class:active={settings.notificationMode === 'browser'}
			onclick={() => settings.notificationMode = 'browser'}
		>
			<span class="mode-name">Browser-based</span>
			<span class="mode-desc">PWA + push notifications</span>
		</button>
		<button
			class="mode-option"
			class:active={settings.notificationMode === 'mcp'}
			onclick={() => settings.notificationMode = 'mcp'}
		>
			<span class="mode-name">Consult User MCP</span>
			<span class="mode-desc">Prompt-based dialogs</span>
		</button>
	</div>

	{#if settings.notificationMode === 'mcp'}
		<McpStatusIndicator />
	{/if}

	{#if settings.notificationMode !== 'none'}
		<div class="setting-row" style="margin-top: 1rem">
			<div class="setting-info">
				<span class="setting-name">Event Subscriptions</span>
				<span class="setting-desc">Choose which events trigger notifications</span>
			</div>
		</div>

		<div class="event-list">
			{#each Object.entries(eventLabels) as [event, info]}
				<label class="event-item">
					<input
						type="checkbox"
						checked={settings.notificationEvents[event as NotificationEventType]}
						onchange={() => toggleEvent(event as NotificationEventType)}
					/>
					<div class="event-info">
						<span class="event-label">{info.label}</span>
						<span class="event-desc">{info.desc}</span>
					</div>
				</label>
			{/each}
		</div>
	{/if}
</section>

<style>
	.settings-section {
		padding: 0.75rem 1.25rem;
	}

	.section-label {
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
		margin: 0 0 0.625rem 0;
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.setting-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.setting-desc {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	/* Mode Selector */
	.mode-selector {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}

	.mode-option {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0.625rem 0.75rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-family: inherit;
		cursor: pointer;
		transition: all 150ms ease;
		text-align: left;
	}

	.mode-option:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.12);
	}

	.mode-option.active {
		background: rgba(99, 102, 241, 0.15);
		border-color: rgba(99, 102, 241, 0.3);
		color: var(--text-primary);
	}

	:global(.app.light) .mode-option {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .mode-option:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	:global(.app.light) .mode-option.active {
		background: rgba(99, 102, 241, 0.1);
		border-color: rgba(99, 102, 241, 0.25);
	}

	.mode-name {
		font-size: 0.75rem;
		font-weight: 600;
		color: inherit;
	}

	.mode-desc {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		margin-top: 0.125rem;
	}

	.mode-option.active .mode-desc {
		color: var(--text-secondary);
	}

	/* Event List */
	.event-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.event-item {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		padding: 0.5rem 0.625rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 150ms ease;
	}

	.event-item:hover {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.08);
	}

	:global(.app.light) .event-item {
		background: rgba(0, 0, 0, 0.02);
		border-color: rgba(0, 0, 0, 0.06);
	}

	:global(.app.light) .event-item:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.event-item input[type="checkbox"] {
		margin-top: 0.125rem;
		width: 14px;
		height: 14px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.event-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex: 1;
	}

	.event-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.event-desc {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}
</style>
