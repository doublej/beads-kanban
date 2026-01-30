<script lang="ts">
	import type { Issue, Comment, Attachment } from '$lib/types';
	import { getPriorityConfig, getTypeIcon, formatTimestamp, getIssueColumn } from '$lib/utils';
	import Icon from './Icon.svelte';
	import IssueFormFields from './IssueFormFields.svelte';
	import IssueLabelsEditor from './IssueLabelsEditor.svelte';
	import IssueDependencies from './IssueDependencies.svelte';
	import IssueComments from './IssueComments.svelte';
	import IssueAttachments from './IssueAttachments.svelte';
	import DetailPanelFooter from './DetailPanelFooter.svelte';

	let isEditMode = $state(false);

	interface Props {
		editingIssue: Issue | null;
		isCreating: boolean;
		createForm: { title: string; description: string; priority: number; issue_type: string; deps?: string[] };
		allIssues?: Issue[];
		activeAgents?: string[];
		agentEnabled?: boolean;
		comments: Comment[];
		attachments: Attachment[];
		loadingAttachments: boolean;
		onuploadattachment: (file: File) => void;
		ondeleteattachment: (filename: string) => void;
		copiedId: string | null;
		newLabelInput: string;
		newComment: string;
		loadingComments: boolean;
		originalLabels: string[];
		isPanelDragging: boolean;
		panelDragOffset: number;
		issueClosedExternally?: boolean;
		onclose: () => void;
		oncreate: () => void;
		oncreateandstartagent?: () => void;
		onstartagent?: (issue: Issue) => void;
		onviewchat?: (agentName: string) => void;
		ondelete: (id: string) => void;
		onsave: (id: string, updates: Partial<Issue>) => void;
		onaddcomment: () => void;
		oncopyid: (text: string, id?: string) => void;
		onsetcolumn: (columnKey: string) => void;
		onaddlabel: (label: string) => void;
		onremovelabel: (label: string) => void;
		onremovedep: (issueId: string, depId: string) => void;
		onpaneltouchstart: (e: TouchEvent) => void;
		onpaneltouchmove: (e: TouchEvent) => void;
		onpaneltouchend: () => void;
		updatecreateform: (key: string, value: any) => void;
		updatenewlabel: (value: string) => void;
		updatenewcomment: (value: string) => void;
		ondismissclosedwarning?: () => void;
	}

	let {
		editingIssue = $bindable(),
		isCreating,
		createForm = $bindable(),
		allIssues = [],
		activeAgents = [],
		agentEnabled = true,
		comments,
		attachments,
		loadingAttachments,
		onuploadattachment,
		ondeleteattachment,
		copiedId,
		newLabelInput = $bindable(),
		newComment = $bindable(),
		loadingComments,
		originalLabels,
		isPanelDragging,
		panelDragOffset,
		issueClosedExternally = false,
		onclose,
		oncreate,
		oncreateandstartagent,
		onstartagent,
		onviewchat,
		ondelete,
		onsave,
		onaddcomment,
		oncopyid,
		onsetcolumn,
		onaddlabel,
		onremovelabel,
		onremovedep,
		onpaneltouchstart,
		onpaneltouchmove,
		onpaneltouchend,
		updatecreateform,
		updatenewlabel,
		updatenewcomment,
		ondismissclosedwarning
	}: Props = $props();

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file) onuploadattachment(file);
				return;
			}
		}
	}

	const isAgentAssignee = $derived(editingIssue?.assignee && (
		editingIssue.assignee.toLowerCase().includes('agent') ||
		editingIssue.assignee.toLowerCase() === 'claude' ||
		editingIssue.assignee.startsWith('@')
	));

	const activeAgentPane = $derived(() => {
		if (!editingIssue) return null;
		const expectedPaneName = `${editingIssue.id}-agent`;
		return activeAgents.includes(expectedPaneName) ? expectedPaneName : null;
	});
</script>

<aside
	class="panel"
	class:dragging={isPanelDragging}
	style={panelDragOffset > 0 ? `transform: translateY(${panelDragOffset}px); opacity: ${1 - panelDragOffset / 200}` : ''}
	ontouchstart={onpaneltouchstart}
	ontouchmove={onpaneltouchmove}
	ontouchend={onpaneltouchend}
	onpaste={handlePaste}
>
	<div class="drag-handle"></div>

	{#if isCreating}
		<!-- CREATE MODE -->
		<header class="header">
			<h2 class="header-title">New Issue</h2>
			<button class="btn-close" onclick={onclose}><Icon name="close" size={18} /></button>
		</header>

		<div class="body">
			<IssueFormFields mode="create" bind:createForm {updatecreateform} {allIssues} />
		</div>

		<DetailPanelFooter mode="create" {agentEnabled} {oncreate} {oncreateandstartagent} {onclose} />

	{:else if editingIssue}
		<!-- VIEW / EDIT MODE -->
		{@const priority = getPriorityConfig(editingIssue.priority)}
		{@const column = getIssueColumn(editingIssue)}

		<header class="header">
			<div class="header-left">
				<button class="id-badge" class:copied={copiedId === `panel-${editingIssue.id}`} onclick={() => oncopyid(editingIssue!.id, `panel-${editingIssue!.id}`)}>
					{editingIssue.id}
					<Icon name={copiedId === `panel-${editingIssue.id}` ? 'check' : 'copy'} size={10} />
				</button>
			</div>
			<div class="header-right">
				<button class="btn-mode" class:active={isEditMode} onclick={() => isEditMode = !isEditMode} title={isEditMode ? 'View mode' : 'Edit mode'}>
					<Icon name={isEditMode ? 'circle' : 'edit'} size={14} />
				</button>
				<button class="btn-close" onclick={onclose}><Icon name="close" size={18} /></button>
			</div>
		</header>

		{#if issueClosedExternally}
			<div class="banner-warning">
				<Icon name="alert-circle" size={14} />
				<span>Issue closed externally</span>
				<button onclick={ondismissclosedwarning}><Icon name="close" size={12} /></button>
			</div>
		{/if}

		<div class="body">
			{#if !isEditMode}
				<!-- VIEW MODE -->
				<div class="specs-bar">
					<div class="specs-primary">
						<span class="spec-status" style="--status-color: {column.accent}">
							<Icon name={column.icon} size={9} />
							<span>{column.label}</span>
						</span>
						<span class="spec-priority" style="--c: {priority.color}">
							<span class="priority-dot"></span>
							<span>{priority.label}</span>
						</span>
						<span class="spec-type">
							<Icon name={getTypeIcon(editingIssue.issue_type)} size={9} />
							<span>{editingIssue.issue_type}</span>
						</span>
					</div>
					<div class="specs-secondary">
						{#if editingIssue.created_at}
							{@const ts = formatTimestamp(editingIssue.created_at)}
							<span class="spec-time" title="{ts.absolute}">{ts.relative}</span>
						{/if}
						{#if editingIssue.assignee}
							{#if isAgentAssignee}
								<span class="spec-agent" class:working={editingIssue.status === 'in_progress'}>
									<Icon name="agent" size={10} />
									<span>{editingIssue.assignee}</span>
									{#if editingIssue.status === 'in_progress'}
										<span class="working-dot"></span>
									{/if}
								</span>
								{#if activeAgentPane() && onviewchat}
									<button class="chat-link" onclick={() => onviewchat(activeAgentPane()!)} title="View chat session">
										<Icon name="message" size={9} />
										<span>Chat</span>
									</button>
								{/if}
							{:else}
								<span class="spec-human">
									<span class="avatar-dot"></span>
									<span>{editingIssue.assignee}</span>
								</span>
							{/if}
						{/if}
					</div>
				</div>

				{#if editingIssue.status === 'closed' && editingIssue.notes}
					<div class="summary-callout">
						<div class="summary-header">
							<Icon name="check-circle" size={12} />
							<span>Summary</span>
						</div>
						<p class="summary-text">{editingIssue.notes}</p>
					</div>
				{/if}

				{#if editingIssue.status === 'closed' && editingIssue.close_reason}
					<div class="close-reason-badge">
						<Icon name="check-circle" size={11} />
						<span>{editingIssue.close_reason}</span>
					</div>
				{/if}

				<article class="content-block">
					<h1 class="issue-title">{editingIssue.title}</h1>
					{#if editingIssue.description}
						<p class="issue-description">{editingIssue.description}</p>
					{/if}
				</article>

				{#if editingIssue.design}
					<section class="section"><span class="section-label">Design</span><p class="prose">{editingIssue.design}</p></section>
				{/if}
				{#if editingIssue.acceptance_criteria}
					<section class="section"><span class="section-label">Acceptance</span><p class="prose">{editingIssue.acceptance_criteria}</p></section>
				{/if}
				{#if editingIssue.notes && editingIssue.status !== 'closed'}
					<section class="section"><span class="section-label">Notes</span><p class="prose">{editingIssue.notes}</p></section>
				{/if}

				{#if editingIssue.labels && editingIssue.labels.length > 0}
					<div class="labels-row">
						{#each editingIssue.labels as label}<span class="label-chip">{label}</span>{/each}
					</div>
				{/if}

			{:else}
				<!-- EDIT MODE -->
				<IssueFormFields mode="edit" bind:editingIssue {column} {activeAgents} {onsetcolumn} />
				<IssueLabelsEditor {editingIssue} bind:newLabelInput {onaddlabel} {onremovelabel} {updatenewlabel} />
			{/if}

			<IssueDependencies {editingIssue} {onremovedep} />
			<IssueComments {comments} bind:newComment {loadingComments} {onaddcomment} {updatenewcomment} />
			<IssueAttachments issueId={editingIssue.id} {attachments} {loadingAttachments} {onuploadattachment} {ondeleteattachment} />
		</div>

		<DetailPanelFooter mode="edit" {agentEnabled} {onclose} {editingIssue} {originalLabels} {onstartagent} {onsave} {ondelete} />
	{/if}
</aside>

<style>
	/* Panel container */
	.panel {
		flex: 0 0 420px;
		min-width: 420px;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		background: var(--surface-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-elevated);
		overflow: hidden;
		animation: slideIn 250ms ease-out;
		position: relative;
		z-index: 1010;
	}

	@keyframes slideIn {
		from { opacity: 0; transform: translateX(-8px); }
		to { opacity: 1; transform: translateX(0); }
	}

	.drag-handle { display: none; }

	/* Header */
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--surface-card);
	}

	.header-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}

	.header-left, .header-right {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.id-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.1875rem 0.375rem;
		background: var(--surface-panel);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xs);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}
	.id-badge:hover { border-color: var(--border-default); color: var(--text-secondary); }
	.id-badge.copied { color: var(--state-done); border-color: rgba(16, 185, 129, 0.3); }

	.btn-close, .btn-mode {
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}
	.btn-close:hover, .btn-mode:hover { background: var(--surface-panel); color: var(--text-primary); }
	.btn-mode.active { background: var(--accent-primary); color: white; }

	/* Body */
	.body {
		flex: 1;
		padding: 1rem;
		overflow-y: auto;
		overflow-x: hidden;
	}
	.body::-webkit-scrollbar { width: 4px; }
	.body::-webkit-scrollbar-track { background: transparent; }
	.body::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 2px; }

	/* View mode - specs bar */
	.specs-bar {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0.625rem 0;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--border-subtle);
		overflow-x: auto;
		white-space: nowrap;
		scrollbar-width: none;
	}
	.specs-bar::-webkit-scrollbar { display: none; }

	.specs-primary { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
	.specs-secondary { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-shrink: 0; }

	/* Unified chip base */
	.spec-status, .spec-priority, .spec-type, .spec-agent, .spec-human, .chat-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 22px;
		padding: 0 8px;
		border-radius: 4px;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.spec-status { background: var(--status-color); color: white; }
	.spec-priority { background: var(--surface-panel, rgba(255,255,255,0.04)); color: var(--text-secondary); }

	.priority-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c); flex-shrink: 0; }

	.spec-type { background: var(--surface-panel, rgba(255,255,255,0.04)); color: var(--text-tertiary); }

	.spec-time {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 9px;
		font-weight: 500;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.spec-agent { background: rgba(16, 185, 129, 0.1); color: #10b981; }
	.spec-agent.working { background: rgba(16, 185, 129, 0.15); }

	.spec-human {
		background: var(--surface-panel, rgba(255,255,255,0.04));
		color: var(--text-secondary);
		font-weight: 500;
	}

	.avatar-dot { width: 6px; height: 6px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }

	.chat-link {
		background: rgba(99, 102, 241, 0.1);
		color: #6366f1;
		border: none;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.chat-link:hover { background: rgba(99, 102, 241, 0.18); }

	:global(.app.light) .chat-link { background: rgba(99, 102, 241, 0.08); color: #4f46e5; }
	:global(.app.light) .chat-link:hover { background: rgba(99, 102, 241, 0.15); }

	.working-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #10b981;
		animation: pulse-dot 1.5s ease-in-out infinite;
		box-shadow: 0 0 4px rgba(16, 185, 129, 0.5);
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(0.8); }
	}

	/* Summary callout */
	.summary-callout {
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: rgba(16, 185, 129, 0.06);
		border-left: 2px solid #10b981;
		border-radius: 4px;
	}

	.summary-header {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		color: #10b981;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		margin-bottom: 0.375rem;
	}

	.summary-text {
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--text-secondary);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.close-reason-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: rgba(16, 185, 129, 0.1);
		border-radius: 4px;
		color: #10b981;
		font-size: 0.75rem;
		font-weight: 500;
		margin-bottom: 0.75rem;
	}

	/* Content block */
	.content-block { margin-bottom: 2rem; }

	.issue-title {
		font-family: 'Instrument Sans', 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 1.5rem;
		font-weight: 650;
		color: var(--text-primary);
		line-height: 1.25;
		letter-spacing: -0.03em;
		margin-bottom: 1rem;
	}

	.issue-description {
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 400;
		color: var(--text-secondary);
		line-height: 1.7;
		white-space: pre-wrap;
		word-break: break-word;
		letter-spacing: -0.005em;
	}

	.section { margin-bottom: 1.25rem; }

	.section-label {
		display: block;
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-tertiary);
		margin-bottom: 0.375rem;
	}

	.prose {
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--text-primary);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.labels-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 1rem;
	}

	.label-chip {
		padding: 0.1875rem 0.5rem;
		background: var(--bg-elevated);
		border-radius: 6px;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	/* Warning banner */
	.banner-warning {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: rgba(239,68,68,0.15);
		border-bottom: 1px solid rgba(239,68,68,0.2);
		color: #fca5a5;
		font-size: 0.75rem;
	}
	.banner-warning button {
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0.125rem;
		margin-left: auto;
		opacity: 0.7;
	}
	.banner-warning button:hover { opacity: 1; }

	/* Mobile */
	@media (max-width: 768px) {
		.panel {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			top: auto;
			width: 100% !important;
			min-width: 100% !important;
			max-width: 100% !important;
			flex: none !important;
			max-height: 80vh;
			border-radius: 16px 16px 0 0;
			z-index: 1010;
			animation: slideUp 300ms cubic-bezier(0.32, 0.72, 0, 1);
			backdrop-filter: saturate(180%) blur(20px);
			background: rgba(39,39,42,0.95);
			box-shadow: 0 -4px 32px rgba(0,0,0,0.4);
			padding-bottom: env(safe-area-inset-bottom);
		}

		.panel.dragging { animation: none; transition: none; }

		.drag-handle {
			display: block;
			width: 2rem;
			height: 3px;
			background: rgba(255,255,255,0.2);
			border-radius: 1.5px;
			margin: 0.375rem auto 0.125rem;
		}
		.panel:active .drag-handle { background: rgba(255,255,255,0.4); }

		@keyframes slideUp {
			from { opacity: 0; transform: translateY(100%); }
			to { opacity: 1; transform: translateY(0); }
		}

		.header { padding: 0.5rem 0.75rem; }
		.header-title { font-size: 0.875rem; }
		.btn-close { width: 1.5rem; height: 1.5rem; }
		.btn-close :global(svg) { width: 14px; height: 14px; }

		.body { padding: 0.5rem 0.75rem; gap: 0.625rem; }
	}

	@media (min-width: 1400px) {
		.panel { flex: 0 0 480px; min-width: 480px; max-width: 480px; }
	}

	@media (min-width: 1800px) {
		.panel { flex: 0 0 520px; min-width: 520px; max-width: 520px; }
	}

	/* Light theme overrides */
	:global(.app.light) .panel { background: var(--surface-elevated); box-shadow: var(--shadow-lg); }
	:global(.app.light) .header { background: var(--surface-card); }
	:global(.app.light) .id-badge { background: rgba(0, 0, 0, 0.04); border-color: var(--border-subtle); }
	:global(.app.light) .id-badge:hover { background: rgba(0, 0, 0, 0.06); }
	:global(.app.light) .specs-bar { border-color: var(--border-subtle); }
	:global(.app.light) .spec-priority, :global(.app.light) .spec-type, :global(.app.light) .spec-human { background: rgba(0, 0, 0, 0.04); }
	:global(.app.light) .spec-agent { background: rgba(16, 185, 129, 0.08); }
	:global(.app.light) .summary-callout { background: rgba(16, 185, 129, 0.05); }
	:global(.app.light) .label-chip { background: rgba(0, 0, 0, 0.04); }
</style>
