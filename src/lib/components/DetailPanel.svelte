<script lang="ts">
	import type { Issue, Comment, Attachment } from '$lib/types';
	import { getPriorityConfig, getTypeIcon, formatTimestamp, getIssueColumn, isAgentAssignee as checkAgentAssignee, getDueInfo, formatMinutes, isStale, parseStateLabels } from '$lib/utils';
	import Icon from './Icon.svelte';
	import { copyState } from '$lib/stores/copy-state.svelte';
	import IssueFormFields from './IssueFormFields.svelte';
	import IssueLabelsEditor from './IssueLabelsEditor.svelte';
	import IssueDependencies from './IssueDependencies.svelte';
	import IssueComments from './IssueComments.svelte';
	import IssueAttachments from './IssueAttachments.svelte';
	import DetailPanelFooter from './DetailPanelFooter.svelte';
	import MarkdownContent from './MarkdownContent.svelte';
	import { appendProjectParam } from '$lib/project';
	import { lintIssueApi, loadIssueHistoryApi, type IssueHistoryEntry } from '$lib/api';

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
		onsetstate?: (dimension: string, value: string, reason?: string) => void;
		onpromote?: (reason?: string) => void;
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
		onsetstate,
		onpromote,
		onremovedep,
		onpaneltouchstart,
		onpaneltouchmove,
		onpaneltouchend,
		updatecreateform,
		updatenewlabel,
		updatenewcomment,
		ondismissclosedwarning
	}: Props = $props();

	const dueInfo = $derived(editingIssue ? getDueInfo(editingIssue.due_at) : null);
	const parsedLabels = $derived(parseStateLabels(editingIssue?.labels));
	const stale = $derived(editingIssue ? isStale(editingIssue) : false);

	// Operational-state inline editor
	let showStateEditor = $state(false);
	let stateDim = $state('');
	let stateVal = $state('');
	const STATE_TOKEN = /^[a-zA-Z0-9_-]+$/;
	const canSubmitState = $derived(STATE_TOKEN.test(stateDim.trim()) && STATE_TOKEN.test(stateVal.trim()));

	function submitState() {
		if (!canSubmitState || !onsetstate) return;
		onsetstate(stateDim.trim(), stateVal.trim());
		stateDim = '';
		stateVal = '';
		showStateEditor = false;
	}

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

	const isAgentAssignee = $derived(checkAgentAssignee(editingIssue?.assignee));

	const activeAgentPane = $derived(() => {
		if (!editingIssue) return null;
		const expectedPaneName = `${editingIssue.id}-agent`;
		return activeAgents.includes(expectedPaneName) ? expectedPaneName : null;
	});

	type RelatedSession = { sessionId: string; agentName?: string; timestamp: string; summary?: string; preview: string[] };
	type RelatedMessage = { role: 'user' | 'assistant' | 'tool'; content: string; toolName?: string; timestamp?: string };

	let relatedSessions = $state<RelatedSession[]>([]);
	let loadingRelated = $state(false);
	let expandedSessionId = $state<string | null>(null);
	let expandedMessages = $state<RelatedMessage[]>([]);
	let loadingExpanded = $state(false);

	// Lint hints (missing recommended sections) for the open issue
	let lintMissing = $state<string[]>([]);
	$effect(() => {
		const id = editingIssue?.id;
		if (!id || isCreating || editingIssue?.status === 'closed') {
			lintMissing = [];
			return;
		}
		// Guard against an out-of-order response from a previously-open issue.
		lintIssueApi(id).then((missing) => { if (editingIssue?.id === id) lintMissing = missing; }).catch(() => { if (editingIssue?.id === id) lintMissing = []; });
	});

	// Per-issue version history (lazy-loaded on expand)
	let historyEntries = $state<IssueHistoryEntry[]>([]);
	let historyOpen = $state(false);
	let loadingHistory = $state(false);
	let lastHistoryId: string | undefined;
	$effect(() => {
		// Reset only when the issue id actually changes (not on same-id object replacement).
		const id = editingIssue?.id;
		if (id === lastHistoryId) return;
		lastHistoryId = id;
		historyOpen = false;
		historyEntries = [];
	});

	async function toggleHistory() {
		if (historyOpen) { historyOpen = false; return; }
		historyOpen = true;
		if (historyEntries.length > 0 || !editingIssue) return;
		const id = editingIssue.id;
		loadingHistory = true;
		try {
			const entries = await loadIssueHistoryApi(id);
			if (editingIssue?.id === id) historyEntries = entries;
		} catch {
			if (editingIssue?.id === id) historyEntries = [];
		} finally {
			if (editingIssue?.id === id) loadingHistory = false;
		}
	}

	$effect(() => {
		const id = editingIssue?.id;
		if (!id || isCreating) {
			relatedSessions = [];
			expandedSessionId = null;
			expandedMessages = [];
			return;
		}
		loadingRelated = true;
		fetch(appendProjectParam(`/api/issues/${encodeURIComponent(id)}/agent-sessions`))
			.then((r) => (r.ok ? r.json() : null))
			.then((payload) => { if (editingIssue?.id === id) relatedSessions = payload?.ok ? (payload.data?.sessions ?? []) : []; })
			.catch(() => { if (editingIssue?.id === id) relatedSessions = []; })
			.finally(() => { if (editingIssue?.id === id) loadingRelated = false; });
	});

	async function toggleRelatedChat(sessionId: string) {
		if (expandedSessionId === sessionId) {
			expandedSessionId = null;
			expandedMessages = [];
			return;
		}
		expandedSessionId = sessionId;
		expandedMessages = [];
		loadingExpanded = true;
		try {
			const r = await fetch(appendProjectParam(`/api/agent-sessions/${encodeURIComponent(sessionId)}/history`));
			if (r.ok) {
				const payload = await r.json();
				expandedMessages = payload?.ok ? (payload.data?.messages ?? []) : [];
			}
		} catch {
			expandedMessages = [];
		} finally {
			loadingExpanded = false;
		}
	}

	function formatRelTime(ts: string): string {
		if (!ts) return '';
		try {
			return formatTimestamp(ts).relative;
		} catch {
			return ts;
		}
	}
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
				<button class="id-badge" class:copied={copyState.copiedId === `panel-${editingIssue.id}`} onclick={() => oncopyid(editingIssue!.id, `panel-${editingIssue!.id}`)} title={editingIssue.id}>
					#{editingIssue.seq}
					<Icon name={copyState.copiedId === `panel-${editingIssue.id}` ? 'check' : 'copy'} size={10} />
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
							<Icon name={column.icon} size={11} />
							<span>{column.label}</span>
						</span>
						<span class="spec-priority" style="--c: {priority.color}">
							<span class="priority-dot"></span>
							<span>{priority.label}</span>
						</span>
						<span class="spec-type">
							<Icon name={getTypeIcon(editingIssue.issue_type)} size={11} />
							<span>{editingIssue.issue_type}</span>
						</span>
					</div>
					<div class="specs-secondary">
						{#if editingIssue.created_at}
							{@const ts = formatTimestamp(editingIssue.created_at)}
							<span class="spec-time" title="{ts.absolute}">{ts.relative}</span>
						{/if}
						{#if dueInfo}
							<span class="spec-due {dueInfo.level}" title="Due {dueInfo.absolute}"><Icon name="calendar" size={11} /><span>{dueInfo.label}</span></span>
						{/if}
						{#if editingIssue.estimated_minutes}
							<span class="spec-est" title="Estimate"><Icon name="clock" size={11} /><span>{formatMinutes(editingIssue.estimated_minutes)}</span></span>
						{/if}
						{#if stale}
							<span class="spec-stale" title="No updates in 30+ days"><Icon name="alert-circle" size={11} /><span>stale</span></span>
						{/if}
						{#if editingIssue.defer_until}
							{@const dts = formatTimestamp(editingIssue.defer_until)}
							<span class="spec-defer" title="Deferred until {dts.absolute}">deferred · {dts.relative}</span>
						{/if}
						{#if editingIssue.assignee}
							{#if isAgentAssignee}
								<span class="spec-agent" class:working={editingIssue.status === 'in_progress'}>
									<Icon name="agent" size={12} />
									<span>{editingIssue.assignee}</span>
									{#if editingIssue.status === 'in_progress'}
										<span class="working-dot"></span>
									{/if}
								</span>
								{#if activeAgentPane() && onviewchat}
									<button class="chat-link" onclick={() => onviewchat(activeAgentPane()!)} title="View chat session">
										<Icon name="message" size={11} />
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

				{#if editingIssue.ephemeral}
					<div class="wisp-banner">
						<div class="wisp-info"><Icon name="zap" size={13} /><span>Wisp{#if editingIssue.wisp_type} · {editingIssue.wisp_type}{/if} — ephemeral, may be compacted</span></div>
						{#if onpromote}<button class="wisp-promote" onclick={() => onpromote()}>Promote</button>{/if}
					</div>
				{/if}

				{#if lintMissing.length > 0}
					<div class="lint-hints">
						<Icon name="alert-circle" size={12} />
						<span class="lint-label">Missing:</span>
						{#each lintMissing as m}<span class="lint-chip">{m.replace(/^#+\s*/, '')}</span>{/each}
					</div>
				{/if}

				{#if editingIssue.status === 'closed' && editingIssue.notes}
					<div class="summary-callout">
						<div class="summary-header">
							<Icon name="check-circle" size={12} />
							<span>Summary</span>
						</div>
						<div class="summary-text"><MarkdownContent content={editingIssue.notes} /></div>
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
						<div class="issue-description"><MarkdownContent content={editingIssue.description} /></div>
					{/if}
				</article>

				{#if editingIssue.design}
					<section class="section"><span class="section-label">Design</span><div class="prose"><MarkdownContent content={editingIssue.design} /></div></section>
				{/if}
				{#if editingIssue.acceptance_criteria}
					<section class="section"><span class="section-label">Acceptance</span><div class="prose"><MarkdownContent content={editingIssue.acceptance_criteria} /></div></section>
				{/if}
				{#if editingIssue.notes && editingIssue.status !== 'closed'}
					<section class="section"><span class="section-label">Notes</span><div class="prose"><MarkdownContent content={editingIssue.notes} /></div></section>
				{/if}

				{#if parsedLabels.states.length > 0 || onsetstate}
					<div class="state-row">
						{#each parsedLabels.states as st (st.dimension + ':' + st.value)}
							<span class="state-badge" title="Operational state"><span class="state-dim">{st.dimension}</span><span class="state-val">{st.value}</span></span>
						{/each}
						{#if onsetstate}
							<button class="state-add" onclick={() => showStateEditor = !showStateEditor} title="Set operational state"><Icon name={showStateEditor ? 'close' : 'plus'} size={11} /><span>state</span></button>
						{/if}
					</div>
					{#if showStateEditor && onsetstate}
						<div class="state-editor">
							<input class="state-input" placeholder="dimension" bind:value={stateDim} onkeydown={(e) => e.key === 'Enter' && submitState()} />
							<span class="state-eq">=</span>
							<input class="state-input" placeholder="value" bind:value={stateVal} onkeydown={(e) => e.key === 'Enter' && submitState()} />
							<button class="state-set" disabled={!canSubmitState} onclick={submitState}>Set</button>
						</div>
					{/if}
				{/if}
				{#if editingIssue.external_ref || editingIssue.spec_id}
					<div class="facet-row">
						{#if editingIssue.external_ref}
							{#if /^https?:\/\//.test(editingIssue.external_ref)}
								<a class="facet-chip" href={editingIssue.external_ref} target="_blank" rel="noopener noreferrer" title={editingIssue.external_ref}><Icon name="external-link" size={10} /><span>{editingIssue.external_ref}</span></a>
							{:else}
								<span class="facet-chip" title="External reference"><Icon name="external-link" size={10} /><span>{editingIssue.external_ref}</span></span>
							{/if}
						{/if}
						{#if editingIssue.spec_id}
							<span class="facet-chip" title="Spec"><Icon name="file" size={10} /><span>{editingIssue.spec_id}</span></span>
						{/if}
					</div>
				{/if}
				{#if parsedLabels.plain.length > 0}
					<div class="labels-row">
						{#each parsedLabels.plain as label (label)}<span class="label-chip">{label}</span>{/each}
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

			{#if relatedSessions.length > 0 || loadingRelated}
				<section class="section">
					<span class="section-label">Related Chats</span>
					{#if loadingRelated && relatedSessions.length === 0}
						<div class="related-empty">Loading…</div>
					{:else}
						<ul class="related-list">
							{#each relatedSessions as session (session.sessionId)}
								{@const isOpen = expandedSessionId === session.sessionId}
								<li class="related-item" class:expanded={isOpen}>
									<button class="related-row" onclick={() => toggleRelatedChat(session.sessionId)}>
										<Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={11} />
										<div class="related-meta">
											<div class="related-title">
												{session.summary || session.agentName || session.sessionId.slice(0, 8)}
											</div>
											{#if session.preview.length > 0}
												<div class="related-preview">{session.preview[0]}</div>
											{/if}
										</div>
										<span class="related-time">{formatRelTime(session.timestamp)}</span>
									</button>
									{#if isOpen}
										<div class="related-history">
											{#if loadingExpanded}
												<div class="related-empty">Loading history…</div>
											{:else if expandedMessages.length === 0}
												<div class="related-empty">No messages.</div>
											{:else}
												{#each expandedMessages as msg, i (i)}
													<div class="chat-msg chat-{msg.role}">
														<span class="chat-role">{msg.role === 'tool' ? (msg.toolName ?? 'tool') : msg.role}</span>
														{#if msg.role === 'assistant'}
															<div class="chat-body"><MarkdownContent content={msg.content} /></div>
														{:else}
															<div class="chat-body chat-plain">{msg.content}</div>
														{/if}
													</div>
												{/each}
											{/if}
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}

				<section class="section">
					<button class="history-toggle" onclick={toggleHistory}>
						<Icon name={historyOpen ? 'chevron-down' : 'chevron-right'} size={11} />
						<span class="section-label">History</span>
					</button>
					{#if historyOpen}
						{#if loadingHistory}
							<div class="related-empty">Loading…</div>
						{:else if historyEntries.length === 0}
							<div class="related-empty">No version history.</div>
						{:else}
							<ul class="history-list">
								{#each historyEntries as entry (entry.hash)}
									<li class="history-item">
										<span class="history-dot"></span>
										<div class="history-meta">
											<div class="history-changes">{entry.changes.join(' · ')}</div>
											<div class="history-time">{formatRelTime(entry.date)}{#if entry.committer} · {entry.committer}{/if}</div>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</section>
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
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
		padding: 0.875rem 0;
		margin-bottom: 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.specs-primary,
	.specs-secondary {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		min-width: 0;
	}
	.specs-secondary:empty { display: none; }

	/* Unified chip base */
	.spec-status, .spec-priority, .spec-type, .spec-agent, .spec-human, .chat-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 10px;
		border-radius: 4px;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 10px;
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
		font-size: 10px;
		font-weight: 500;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.spec-agent { background: rgba(16, 185, 129, 0.1); color: #10b981; }
	.spec-agent.working { background: rgba(16, 185, 129, 0.15); }

	/* bd 1.0 scheduling chips */
	.spec-due, .spec-est {
		display: inline-flex; align-items: center; gap: 3px;
		padding: 0.1875rem 0.375rem; border-radius: var(--radius-xs);
		font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 10px; font-weight: 600;
		flex-shrink: 0;
	}
	.spec-est { background: rgba(148, 163, 184, 0.14); color: var(--text-tertiary); }
	.spec-due.normal { background: rgba(99, 102, 241, 0.12); color: #6366f1; }
	.spec-due.soon { background: rgba(245, 158, 11, 0.14); color: #f59e0b; }
	.spec-due.overdue { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
	.spec-stale {
		display: inline-flex; align-items: center; gap: 3px;
		padding: 0.1875rem 0.375rem; border-radius: var(--radius-xs);
		font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 10px; font-weight: 600;
		background: rgba(245, 158, 11, 0.12); color: #f59e0b; flex-shrink: 0;
	}
	.spec-defer {
		font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 10px; font-weight: 500;
		color: var(--text-tertiary); flex-shrink: 0;
	}

	/* operational-state badges + external_ref/spec facets */
	.state-row, .facet-row { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.5rem; }
	.state-badge {
		display: inline-flex; align-items: stretch; border-radius: var(--radius-xs); overflow: hidden;
		font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 0.625rem; font-weight: 600;
	}
	.state-badge .state-dim { padding: 0.125rem 0.375rem; background: rgba(20, 184, 166, 0.16); color: #14b8a6; text-transform: uppercase; letter-spacing: 0.03em; }
	.state-badge .state-val { padding: 0.125rem 0.375rem; background: rgba(20, 184, 166, 0.28); color: #0d9488; }
	.state-add {
		display: inline-flex; align-items: center; gap: 3px;
		padding: 0.125rem 0.4rem; border-radius: var(--radius-xs);
		background: transparent; border: 1px dashed var(--border-default);
		color: var(--text-tertiary); font-size: 0.625rem; font-weight: 600; cursor: pointer;
	}
	.state-add:hover { color: #14b8a6; border-color: #14b8a6; }
	.state-editor { display: flex; align-items: center; gap: 0.375rem; margin-top: 0.375rem; }
	.state-eq { color: var(--text-tertiary); font-weight: 700; }
	.state-input {
		flex: 1; min-width: 0; padding: 0.25rem 0.5rem; border-radius: var(--radius-xs);
		background: rgba(255,255,255,0.04); border: 1px solid var(--border-subtle);
		color: var(--text-primary); font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 0.6875rem;
	}
	.state-input:focus { outline: none; border-color: #14b8a6; }
	.state-set {
		padding: 0.25rem 0.625rem; border-radius: var(--radius-xs);
		background: #14b8a6; border: none; color: #fff; font-size: 0.6875rem; font-weight: 600; cursor: pointer;
	}
	.state-set:disabled { opacity: 0.4; cursor: not-allowed; }

	/* wisp / promote banner */
	.wisp-banner {
		display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
		margin-bottom: 0.75rem; padding: 0.5rem 0.625rem; border-radius: var(--radius-sm, 8px);
		background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.3);
	}
	.wisp-info { display: flex; align-items: center; gap: 0.4rem; color: #8b5cf6; font-size: 0.6875rem; font-weight: 600; }
	.wisp-promote {
		flex-shrink: 0; padding: 0.25rem 0.625rem; border-radius: var(--radius-xs);
		background: #8b5cf6; border: none; color: #fff; font-size: 0.6875rem; font-weight: 600; cursor: pointer;
	}
	.wisp-promote:hover { background: #7c3aed; }

	/* lint hints */
	.lint-hints {
		display: flex; align-items: center; flex-wrap: wrap; gap: 0.375rem;
		margin-bottom: 0.75rem; padding: 0.375rem 0.5rem; border-radius: var(--radius-xs);
		background: rgba(245, 158, 11, 0.1); color: #f59e0b; font-size: 0.625rem;
	}
	.lint-label { font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
	.lint-chip { padding: 0.0625rem 0.375rem; border-radius: var(--radius-xs); background: rgba(245, 158, 11, 0.18); font-weight: 500; }
	.facet-chip {
		display: inline-flex; align-items: center; gap: 4px; max-width: 100%;
		padding: 0.1875rem 0.4rem; border-radius: var(--radius-xs);
		background: var(--surface-panel, rgba(255,255,255,0.04)); color: var(--text-secondary);
		font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 0.625rem; text-decoration: none;
	}
	.facet-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	a.facet-chip:hover { color: var(--text-primary); }

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
		word-break: break-word;
	}

	.labels-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 1rem;
	}

	/* Related Chats */
	.related-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.related-item {
		border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
		border-radius: 6px;
		background: var(--bg-elevated, rgba(255,255,255,0.02));
		overflow: hidden;
	}
	.related-item.expanded {
		border-color: var(--border-strong, rgba(255,255,255,0.12));
	}
	.related-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.625rem;
		background: transparent;
		border: none;
		text-align: left;
		cursor: pointer;
		color: var(--text-primary);
	}
	.related-row:hover { background: rgba(255,255,255,0.03); }
	.related-meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.related-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.related-preview {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.related-time {
		font-size: 0.625rem;
		color: var(--text-tertiary);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.related-empty {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		padding: 0.5rem 0.625rem;
	}

	/* Per-issue history timeline */
	.history-toggle {
		display: flex; align-items: center; gap: 0.375rem;
		background: none; border: none; padding: 0; cursor: pointer; color: inherit;
	}
	.history-toggle .section-label { margin: 0; }
	.history-list { list-style: none; margin: 0.5rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
	.history-item { display: flex; align-items: flex-start; gap: 0.5rem; }
	.history-dot {
		flex-shrink: 0; width: 6px; height: 6px; margin-top: 0.3rem; border-radius: 50%;
		background: var(--accent-primary, #6366f1);
	}
	.history-meta { display: flex; flex-direction: column; gap: 0.0625rem; min-width: 0; }
	.history-changes { font-size: 0.6875rem; color: var(--text-secondary); }
	.history-time { font-size: 0.5625rem; color: var(--text-tertiary); }
	.related-history {
		border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
		padding: 0.5rem 0.625rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 320px;
		overflow-y: auto;
	}
	.chat-msg {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.chat-role {
		font-size: 0.5625rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 700;
		color: var(--text-tertiary);
	}
	.chat-user .chat-role { color: var(--accent, #9ca3af); }
	.chat-assistant .chat-role { color: var(--success, #86efac); }
	.chat-body {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--text-primary);
		word-break: break-word;
	}
	.chat-plain { white-space: pre-wrap; }

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
