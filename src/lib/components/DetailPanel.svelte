<script lang="ts">
	import type { Issue, Comment, Attachment } from '$lib/types';
	import { getPriorityConfig, getTypeIcon, getDepTypeConfig, formatTimestamp, formatDuration, getIssueColumn, columns } from '$lib/utils';
	import Icon from './Icon.svelte';
	import IssueSearch from './IssueSearch.svelte';

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

	function addDepToCreate(issue: Issue) {
		const deps = createForm.deps || [];
		if (!deps.includes(issue.id)) updatecreateform('deps', [...deps, issue.id]);
	}

	function removeDepFromCreate(issueId: string) {
		updatecreateform('deps', (createForm.deps || []).filter((id: string) => id !== issueId));
	}

	function getIssueById(id: string): Issue | undefined {
		return allIssues.find(i => i.id === id);
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	function isImageMimetype(mimetype: string): boolean {
		return mimetype.startsWith('image/');
	}

	function handleFileDrop(e: DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer?.files[0];
		if (file) onuploadattachment(file);
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			onuploadattachment(file);
			input.value = '';
		}
	}

	// Combine dependencies and dependents for unified relations view
	const relations = $derived(() => {
		if (!editingIssue) return [];
		const deps = (editingIssue.dependencies || []).map(d => ({ ...d, direction: 'blocked-by' as const }));
		const depts = (editingIssue.dependents || []).map(d => ({ ...d, direction: 'blocking' as const }));
		return [...deps, ...depts];
	});

	// Check if assignee is an agent
	const isAgentAssignee = $derived(editingIssue?.assignee && (
		editingIssue.assignee.toLowerCase().includes('agent') ||
		editingIssue.assignee.toLowerCase() === 'claude' ||
		editingIssue.assignee.startsWith('@')
	));

	// Check if there's an active agent chat for this issue (pane name is "{issue-id}-agent")
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
>
	<div class="drag-handle"></div>

	{#if isCreating}
		<!-- CREATE MODE -->
		<header class="header">
			<h2 class="header-title">New Issue</h2>
			<button class="btn-close" onclick={onclose}><Icon name="close" size={18} /></button>
		</header>

		<div class="body">
			<div class="field">
				<input id="create-title" type="text" class="input-title" bind:value={createForm.title} placeholder="What needs to be done?" />
			</div>

			<div class="field">
				<textarea id="create-desc" class="input-desc" bind:value={createForm.description} rows="4" placeholder="Add details..."></textarea>
			</div>

			<div class="field-row">
				<div class="field field-half">
					<label class="field-label">Priority</label>
					<div class="pill-group">
						{#each [0, 1, 2, 3, 4] as p}
							{@const cfg = getPriorityConfig(p)}
							<button class="pill" class:active={createForm.priority === p} style="--pill-color: {cfg.color}" onclick={() => updatecreateform('priority', p)}>
								<span class="pill-dot"></span><span class="pill-text">{cfg.label}</span>
							</button>
						{/each}
					</div>
				</div>
				<div class="field field-half">
					<label class="field-label">Type</label>
					<div class="pill-group">
						{#each ['task', 'bug', 'feature', 'epic', 'chore'] as t}
							<button class="pill pill-icon" class:active={createForm.issue_type === t} onclick={() => updatecreateform('issue_type', t)}>
								<Icon name={getTypeIcon(t)} size={12} /><span class="pill-text">{t}</span>
							</button>
						{/each}
					</div>
				</div>
			</div>

			<div class="field">
				<label class="field-label">Blocked By</label>
				<IssueSearch issues={allIssues} excludeIds={createForm.deps || []} placeholder="Link blocker..." onselect={addDepToCreate} />
				{#if createForm.deps && createForm.deps.length > 0}
					<div class="dep-chips">
						{#each createForm.deps as depId}
							{@const dep = getIssueById(depId)}
							{#if dep}
								<span class="dep-chip">
									<span class="dep-chip-id">{dep.id}</span>
									<span class="dep-chip-title">{dep.title}</span>
									<button class="dep-chip-x" onclick={() => removeDepFromCreate(depId)}>×</button>
								</span>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<footer class="footer footer-create">
			<button class="btn-secondary" onclick={onclose}>Cancel</button>
			<div class="footer-actions">
				{#if agentEnabled && oncreateandstartagent}
					<button class="btn-agent" onclick={oncreateandstartagent} title="Create issue and start agent">
						<Icon name="agent" size={14} />Create + Agent
					</button>
				{/if}
				<button class="btn-primary" onclick={oncreate}>
					<Icon name="plus" size={16} strokeWidth={2.5} />Create
					<kbd class="kbd">⌘↵</kbd>
				</button>
			</div>
		</footer>

	{:else if editingIssue}
		<!-- VIEW / EDIT MODE -->
		{@const priority = getPriorityConfig(editingIssue.priority)}
		{@const column = getIssueColumn(editingIssue)}

		<header class="header">
			<div class="header-left">
				<button class="id-badge" class:copied={copiedId === `panel-${editingIssue.id}`} onclick={() => oncopyid(editingIssue.id, `panel-${editingIssue.id}`)}>
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
				<!-- Specs bar: clean metadata row with rhythm -->
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

				<!-- Summary callout for completed issues -->
				{#if editingIssue.status === 'closed' && editingIssue.notes}
					<div class="summary-callout">
						<div class="summary-header">
							<Icon name="check-circle" size={12} />
							<span>Summary</span>
						</div>
						<p class="summary-text">{editingIssue.notes}</p>
					</div>
				{/if}

				<!-- Content block: title + description with typography focus -->
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
				<div class="field">
					<label class="field-label">Title</label>
					<input type="text" class="input" bind:value={editingIssue.title} />
				</div>

				<div class="field">
					<label class="field-label">Description</label>
					<textarea class="input" bind:value={editingIssue.description} rows="4"></textarea>
				</div>

				<div class="field">
					<label class="field-label">Status</label>
					<div class="pill-group">
						{#each columns as col}
							<button class="pill pill-status" class:active={column.key === col.key} style="--pill-color: {col.accent}" onclick={() => onsetcolumn(col.key)}>
								<Icon name={col.icon} size={11} /><span class="pill-text">{col.label}</span>
							</button>
						{/each}
					</div>
				</div>

				<div class="field-row">
					<div class="field field-half">
						<label class="field-label">Priority</label>
						<div class="pill-group compact">
							{#each [0, 1, 2, 3, 4] as p}
								{@const cfg = getPriorityConfig(p)}
								<button class="pill" class:active={editingIssue.priority === p} style="--pill-color: {cfg.color}" onclick={() => editingIssue.priority = p as 0|1|2|3|4}>
									<span class="pill-dot"></span><span class="pill-text">{cfg.label}</span>
								</button>
							{/each}
						</div>
					</div>
					<div class="field field-half">
						<label class="field-label">Type</label>
						<div class="pill-group compact">
							{#each ['task', 'bug', 'feature', 'epic', 'chore'] as t}
								<button class="pill pill-icon" class:active={editingIssue.issue_type === t} onclick={() => editingIssue.issue_type = t}>
									<Icon name={getTypeIcon(t)} size={11} /><span class="pill-text">{t}</span>
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Optional fields -->
				{#if editingIssue.design || editingIssue._showDesign}
					<div class="field collapsible">
						<label class="field-label">Design <button class="btn-x" onclick={() => { editingIssue.design = ''; editingIssue._showDesign = false; }}>×</button></label>
						<textarea class="input" bind:value={editingIssue.design} rows="2" placeholder="Technical approach..."></textarea>
					</div>
				{/if}
				{#if editingIssue.acceptance_criteria || editingIssue._showAcceptance}
					<div class="field collapsible">
						<label class="field-label">Acceptance <button class="btn-x" onclick={() => { editingIssue.acceptance_criteria = ''; editingIssue._showAcceptance = false; }}>×</button></label>
						<textarea class="input" bind:value={editingIssue.acceptance_criteria} rows="2" placeholder="Definition of done..."></textarea>
					</div>
				{/if}
				{#if editingIssue.notes || editingIssue._showNotes}
					<div class="field collapsible">
						<label class="field-label">Notes <button class="btn-x" onclick={() => { editingIssue.notes = ''; editingIssue._showNotes = false; }}>×</button></label>
						<textarea class="input" bind:value={editingIssue.notes} rows="2" placeholder="Progress updates..."></textarea>
					</div>
				{/if}

				{#if !editingIssue.design && !editingIssue._showDesign || !editingIssue.acceptance_criteria && !editingIssue._showAcceptance || !editingIssue.notes && !editingIssue._showNotes}
					<div class="add-fields">
						{#if !editingIssue.design && !editingIssue._showDesign}<button class="btn-add" onclick={() => editingIssue._showDesign = true}>+ Design</button>{/if}
						{#if !editingIssue.acceptance_criteria && !editingIssue._showAcceptance}<button class="btn-add" onclick={() => editingIssue._showAcceptance = true}>+ Acceptance</button>{/if}
						{#if !editingIssue.notes && !editingIssue._showNotes}<button class="btn-add" onclick={() => editingIssue._showNotes = true}>+ Notes</button>{/if}
					</div>
				{/if}

				<div class="field">
					<label class="field-label">Assignee {#if activeAgents.length > 0}<span class="agent-hint">({activeAgents.length} agents)</span>{/if}</label>
					<input type="text" class="input input-sm" bind:value={editingIssue.assignee} placeholder="e.g. agent1, @user, claude" list="assignee-agents" autocomplete="off" />
					<datalist id="assignee-agents">
						{#each activeAgents as agent}
							<option value={agent} />
						{/each}
					</datalist>
				</div>

				<div class="field">
					<label class="field-label">Labels</label>
					<div class="label-editor">
						{#if editingIssue.labels && editingIssue.labels.length > 0}
							<div class="label-chips">
								{#each editingIssue.labels as label}
									<span class="label-chip editable">{label}<button onclick={() => onremovelabel(label)}>×</button></span>
								{/each}
							</div>
						{/if}
						<div class="label-input-row">
							<input type="text" class="input input-sm" placeholder="Add label..." bind:value={newLabelInput} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onaddlabel(newLabelInput); }}} />
							<button class="btn-add-label" onclick={() => onaddlabel(newLabelInput)} disabled={!newLabelInput.trim()}>+</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Relations (deps + dependents) -->
			{#if relations().length > 0}
				<section class="section">
					<span class="section-label">Relations</span>
					<div class="relations">
						{#each relations() as rel}
							{@const cfg = getDepTypeConfig(rel.dependency_type)}
							<div class="relation" class:blocked-by={rel.direction === 'blocked-by'} class:blocking={rel.direction === 'blocking'}>
								<span class="rel-type" style="background: {cfg.color}20; color: {cfg.color}" title={cfg.label}><Icon name={cfg.icon} size={10} /></span>
								<span class="rel-status" class:open={rel.status === 'open'} class:in-progress={rel.status === 'in_progress'} class:closed={rel.status === 'closed'}></span>
								<span class="rel-id">{rel.id}</span>
								<span class="rel-title">{rel.title}</span>
								<button class="rel-x" onclick={() => rel.direction === 'blocked-by' ? onremovedep(editingIssue.id, rel.id) : onremovedep(rel.id, editingIssue.id)}>×</button>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Comments -->
			<section class="section">
				<span class="section-label">Comments {#if loadingComments}<span class="loading">...</span>{/if}</span>
				{#if comments.length > 0}
					<div class="comments">
						{#each comments as c}
							{@const ts = formatTimestamp(c.created_at)}
							<div class="comment">
								<div class="comment-head"><span class="comment-author">{c.author}</span><span class="comment-time" title="{ts.absolute}">{ts.relative}</span></div>
								<p class="comment-text">{c.text}</p>
							</div>
						{/each}
					</div>
				{:else if !loadingComments}
					<p class="empty">No comments</p>
				{/if}
				<div class="comment-input">
					<textarea bind:value={newComment} rows="2" placeholder="Add comment..." onkeydown={(e) => { if (e.key === 'Enter' && e.metaKey) onaddcomment(); }}></textarea>
					<button class="btn-send" onclick={onaddcomment} disabled={!newComment.trim()}><Icon name="send" size={14} /></button>
				</div>
			</section>

			<!-- Attachments -->
			<section class="section">
				<span class="section-label">Attachments {#if loadingAttachments}<span class="loading">...</span>{/if}</span>
				{#if attachments.length > 0}
					<div class="attachments">
						{#each attachments as a}
							{@const ts = formatTimestamp(a.created_at)}
							<div class="attachment">
								{#if isImageMimetype(a.mimetype)}
									<img src="/api/issues/{editingIssue.id}/attachments/{a.filename}" alt={a.filename} class="att-thumb" />
								{:else}
									<div class="att-icon"><Icon name="file" size={14} /></div>
								{/if}
								<div class="att-info">
									<a href="/api/issues/{editingIssue.id}/attachments/{a.filename}" download={a.filename} class="att-name">{a.filename}</a>
									<span class="att-meta">{formatFileSize(a.size)} · {ts.relative}</span>
								</div>
								<button class="att-x" onclick={() => { if (confirm('Delete?')) ondeleteattachment(a.filename); }}><Icon name="trash" size={11} /></button>
							</div>
						{/each}
					</div>
				{:else if !loadingAttachments}
					<p class="empty">No attachments</p>
				{/if}
				<div class="dropzone" ondragover={(e) => e.preventDefault()} ondrop={handleFileDrop}>
					<input type="file" id="att-input" class="dropzone-input" onchange={handleFileSelect} />
					<label for="att-input" class="dropzone-label"><Icon name="plus" size={14} /><span>Drop or click</span></label>
				</div>
			</section>
		</div>

		<footer class="footer">
			<button class="btn-danger" onclick={() => ondelete(editingIssue.id)}><Icon name="trash" size={13} />Delete</button>
			<div class="footer-actions">
				{#if agentEnabled && onstartagent && editingIssue.status !== 'closed'}
					<button class="btn-agent" onclick={() => onstartagent(editingIssue)} title="Start agent to work on this issue">
						<Icon name="agent" size={14} />Start Agent
					</button>
				{/if}
				<button class="btn-primary" onclick={() => {
					const cur = editingIssue.labels || [];
					const add = cur.filter(l => !originalLabels.includes(l));
					const rm = originalLabels.filter(l => !cur.includes(l));
					onsave(editingIssue.id, { ...editingIssue, addLabels: add, removeLabels: rm } as any);
					onclose();
				}}>Save</button>
			</div>
		</footer>
	{/if}
</aside>

<style>
	/* ═══════════════════════════════════════════════════════════════
	   PANEL CONTAINER - Elevated surface with clear structure
	   ═══════════════════════════════════════════════════════════════ */
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

	/* ═══════════════════════════════════════════════════════════════
	   HEADER - Clean with quick actions
	   ═══════════════════════════════════════════════════════════════ */
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

	/* ═══════════════════════════════════════════════════════════════
	   BODY
	   ═══════════════════════════════════════════════════════════════ */
	.body {
		flex: 1;
		padding: 1rem;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.body::-webkit-scrollbar {
		width: 4px;
	}

	.body::-webkit-scrollbar-track {
		background: transparent;
	}

	.body::-webkit-scrollbar-thumb {
		background: var(--border-subtle);
		border-radius: 2px;
	}

	/* ═══════════════════════════════════════════════════════════════
	   VIEW MODE - SPECS BAR (Uniform chips, no wrap)
	   ═══════════════════════════════════════════════════════════════ */
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

	.specs-bar::-webkit-scrollbar {
		display: none;
	}

	.specs-primary {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.specs-secondary {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
		flex-shrink: 0;
	}

	/* Unified chip base - all chips same height/padding */
	.spec-status,
	.spec-priority,
	.spec-type,
	.spec-agent,
	.spec-human,
	.chat-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 22px;
		padding: 0 8px;
		border-radius: 4px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* Status - solid accent */
	.spec-status {
		background: var(--status-color);
		color: white;
	}

	/* Priority - muted with dot indicator */
	.spec-priority {
		background: var(--surface-panel, rgba(255,255,255,0.04));
		color: var(--text-secondary);
	}

	.priority-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--c);
		flex-shrink: 0;
	}

	/* Type - muted */
	.spec-type {
		background: var(--surface-panel, rgba(255,255,255,0.04));
		color: var(--text-tertiary);
	}

	/* Time - plain text, no chip */
	.spec-time {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 9px;
		font-weight: 500;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	/* Agent assignee - green accent */
	.spec-agent {
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
	}

	.spec-agent.working {
		background: rgba(16, 185, 129, 0.15);
	}

	/* Human assignee - neutral */
	.spec-human {
		background: var(--surface-panel, rgba(255,255,255,0.04));
		color: var(--text-secondary);
		font-weight: 500;
	}

	.avatar-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #6366f1;
		flex-shrink: 0;
	}

	/* Chat link - accent interactive */
	.chat-link {
		background: rgba(99, 102, 241, 0.1);
		color: #6366f1;
		border: none;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.chat-link:hover {
		background: rgba(99, 102, 241, 0.18);
	}

	:global(.app.light) .chat-link {
		background: rgba(99, 102, 241, 0.08);
		color: #4f46e5;
	}

	:global(.app.light) .chat-link:hover {
		background: rgba(99, 102, 241, 0.15);
	}

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

	/* ═══════════════════════════════════════════════════════════════
	   VIEW MODE - SUMMARY CALLOUT (completed issues)
	   ═══════════════════════════════════════════════════════════════ */
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
		font-family: 'JetBrains Mono', ui-monospace, monospace;
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

	/* ═══════════════════════════════════════════════════════════════
	   VIEW MODE - CONTENT BLOCK (Title + Description)
	   ═══════════════════════════════════════════════════════════════ */
	.content-block {
		margin-bottom: 2rem;
	}

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

	.section {
		margin-bottom: 1.25rem;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.375rem;
	}

	.section-label {
		display: block;
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-tertiary);
		margin-bottom: 0.375rem;
	}

	.section-head .section-label { margin-bottom: 0; }

	.btn-copy-sm {
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-tertiary);
		cursor: pointer;
		opacity: 0;
		transition: all 150ms ease;
	}
	.section:hover .btn-copy-sm { opacity: 1; }
	.btn-copy-sm:hover { background: var(--bg-tertiary); color: var(--text-secondary); }
	.btn-copy-sm.copied { color: #10b981; opacity: 1; }

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

	/* ═══════════════════════════════════════════════════════════════
	   EDIT MODE / FIELDS
	   ═══════════════════════════════════════════════════════════════ */
	.field {
		margin-bottom: 1rem;
	}

	.field-row {
		display: flex;
		gap: 1rem;
	}

	.field-half {
		flex: 1;
	}

	.field-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
		margin-bottom: 0.375rem;
	}

	.input, .input-title, .input-desc {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: rgba(255,255,255,0.04);
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.8125rem;
		transition: all 150ms ease;
		resize: vertical;
	}
	.input:focus, .input-title:focus, .input-desc:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px var(--accent-glow);
	}
	.input::placeholder, .input-title::placeholder, .input-desc::placeholder { color: var(--text-tertiary); }

	.input-title {
		font-size: 1rem;
		font-weight: 600;
		padding: 0.625rem 0.875rem;
	}

	.input-sm { padding: 0.375rem 0.625rem; font-size: 0.75rem; }

	:global(.app.light) .input,
	:global(.app.light) .input-title,
	:global(.app.light) .input-desc {
		background: rgba(255,255,255,0.8);
		border-color: rgba(0,0,0,0.08);
	}

	/* Pill buttons */
	.pill-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.pill-group.compact { gap: 0.1875rem; }

	.pill {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		width: 5.25rem;
		height: 1.625rem;
		padding: 0 0.75rem 0 0.5rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		font-family: inherit;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 150ms ease;
		text-transform: capitalize;
		white-space: nowrap;
	}
	.pill:hover { border-color: var(--border-default); background: var(--bg-elevated); }
	.pill.active { border-color: var(--pill-color); color: var(--pill-color); background: rgba(0,0,0,0.15); }
	.pill-status.active { background: var(--pill-color); color: white; }

	.pill-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--pill-color);
		flex-shrink: 0;
		margin-right: 0.375rem;
	}

	.pill :global(svg) {
		flex-shrink: 0;
		margin-right: 0.375rem;
	}

	.pill-text {
		flex: 1;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global(.app.light) .pill.active { background: rgba(255,255,255,0.8); }
	:global(.app.light) .pill-status.active { background: var(--pill-color); }

	/* Collapsible fields */
	.field.collapsible .field-label { display: flex; }
	.btn-x {
		width: 1rem;
		height: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-tertiary);
		font-size: 0.875rem;
		cursor: pointer;
		opacity: 0;
		transition: all 150ms ease;
	}
	.field.collapsible:hover .btn-x { opacity: 1; }
	.btn-x:hover { background: rgba(239,68,68,0.15); color: #ef4444; }

	.add-fields {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.btn-add {
		padding: 0.3125rem 0.625rem;
		background: transparent;
		border: 1px dashed var(--border-default);
		border-radius: 8px;
		font-family: inherit;
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all 150ms ease;
	}
	.btn-add:hover { border-color: var(--accent-primary); color: var(--accent-primary); background: var(--accent-glow); }

	/* Labels */
	.label-editor { display: flex; flex-direction: column; gap: 0.5rem; }
	.label-chips { display: flex; flex-wrap: wrap; gap: 0.25rem; }
	.label-chip.editable { display: inline-flex; align-items: center; gap: 0.25rem; }
	.label-chip.editable button {
		background: none;
		border: none;
		color: var(--text-tertiary);
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0;
		line-height: 1;
	}
	.label-chip.editable button:hover { color: #ef4444; }
	.label-input-row { display: flex; gap: 0.375rem; }
	.btn-add-label {
		padding: 0.375rem 0.625rem;
		background: var(--accent-primary);
		border: none;
		border-radius: 8px;
		color: white;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-add-label:disabled { opacity: 0.4; cursor: not-allowed; }

	/* ═══════════════════════════════════════════════════════════════
	   RELATIONS
	   ═══════════════════════════════════════════════════════════════ */
	.relations {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.relation {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4375rem 0.625rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: 8px;
		font-size: 0.6875rem;
	}
	.relation.blocked-by { border-left: 3px solid #ef4444; }
	.relation.blocking { border-left: 3px solid #10b981; }

	.rel-type {
		padding: 0.125rem 0.25rem;
		border-radius: 4px;
		font-size: 0.5625rem;
	}

	.rel-status {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--text-tertiary);
		flex-shrink: 0;
	}
	.rel-status.open { background: #6366f1; }
	.rel-status.in-progress { background: #f59e0b; }
	.rel-status.closed { background: #10b981; }

	.rel-id {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.5625rem;
		color: var(--text-tertiary);
	}

	.rel-title {
		flex: 1;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rel-x {
		background: none;
		border: none;
		color: var(--text-tertiary);
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0;
		opacity: 0;
		transition: opacity 150ms ease;
	}
	.relation:hover .rel-x { opacity: 1; }
	.rel-x:hover { color: #ef4444; }

	/* ═══════════════════════════════════════════════════════════════
	   COMMENTS
	   ═══════════════════════════════════════════════════════════════ */
	.comments {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		max-height: 160px;
		overflow-y: auto;
		margin-bottom: 0.5rem;
	}

	.comment {
		padding: 0.5rem 0.625rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: 8px;
	}

	.comment-head {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.1875rem;
	}

	.comment-author {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--accent-primary);
	}

	.comment-time {
		font-size: 0.5625rem;
		color: var(--text-tertiary);
	}

	.comment-text {
		font-size: 0.75rem;
		color: var(--text-secondary);
		line-height: 1.45;
		white-space: pre-wrap;
	}

	.empty {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		text-align: center;
		padding: 0.75rem;
	}

	.comment-input {
		display: flex;
		gap: 0.375rem;
		align-items: flex-end;
	}

	.comment-input textarea {
		flex: 1;
		min-height: 48px;
		padding: 0.5rem 0.625rem;
		background: rgba(255,255,255,0.04);
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.75rem;
		resize: none;
	}
	.comment-input textarea:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.btn-send {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-primary);
		border: none;
		border-radius: 8px;
		color: white;
		cursor: pointer;
		flex-shrink: 0;
		transition: all 150ms ease;
	}
	.btn-send:hover:not(:disabled) { filter: brightness(1.1); }
	.btn-send:disabled { opacity: 0.4; cursor: not-allowed; }

	/* ═══════════════════════════════════════════════════════════════
	   ATTACHMENTS
	   ═══════════════════════════════════════════════════════════════ */
	.attachments {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		max-height: 140px;
		overflow-y: auto;
		margin-bottom: 0.5rem;
	}

	.attachment {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.375rem 0.5rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: 8px;
	}

	.att-thumb {
		width: 2rem;
		height: 2rem;
		object-fit: cover;
		border-radius: 6px;
		flex-shrink: 0;
	}

	.att-icon {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-elevated);
		border-radius: 6px;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.att-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}

	.att-name {
		font-size: 0.75rem;
		color: var(--accent-primary);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.att-name:hover { text-decoration: underline; }

	.att-meta {
		font-size: 0.5625rem;
		color: var(--text-tertiary);
	}

	.att-x {
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 4px;
		opacity: 0;
		transition: all 150ms ease;
	}
	.attachment:hover .att-x { opacity: 1; }
	.att-x:hover { color: #ef4444; background: rgba(239,68,68,0.1); }

	/* Compact dropzone - reduced from large dashed area */
	.dropzone {
		position: relative;
		border: 1px dashed var(--border-default);
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
	}
	.dropzone:hover, .dropzone:focus-within {
		border-color: var(--accent-primary);
		border-style: solid;
		background: var(--accent-glow);
	}

	.dropzone-input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.dropzone-label {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.375rem 0.5rem;
		color: var(--text-muted);
		font-size: 0.625rem;
		font-weight: 500;
		cursor: pointer;
	}
	.dropzone:hover .dropzone-label { color: var(--accent-primary); }

	.loading { color: var(--text-tertiary); font-weight: 400; }

	/* ═══════════════════════════════════════════════════════════════
	   FOOTER - Clear action bar
	   ═══════════════════════════════════════════════════════════════ */
	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--border-subtle);
		background: var(--surface-card);
	}

	:global(.app.light) .footer { background: var(--surface-panel); }

	.btn-secondary, .btn-primary, .btn-danger {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.4375rem 0.75rem;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-secondary {
		background: var(--surface-panel);
		border-color: var(--border-default);
		color: var(--text-primary);
	}
	.btn-secondary:hover { background: var(--surface-card); border-color: var(--border-strong); }

	.btn-primary {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
		color: white;
	}
	.btn-primary:hover { background: #2563eb; }

	.btn-danger {
		background: rgba(239,68,68,0.1);
		border-color: rgba(239,68,68,0.2);
		color: #ef4444;
	}
	.btn-danger:hover { background: rgba(239,68,68,0.18); border-color: rgba(239,68,68,0.35); }

	.btn-agent {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.4375rem 0.625rem;
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.25);
		border-radius: var(--radius-sm);
		font-family: var(--font-sans);
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--state-done);
		cursor: pointer;
		transition: all var(--transition-fast);
	}
	.btn-agent:hover {
		background: rgba(16, 185, 129, 0.18);
		border-color: rgba(16, 185, 129, 0.4);
	}

	.footer-create {
		flex-wrap: wrap;
	}

	.footer-actions {
		display: flex;
		gap: 0.375rem;
		align-items: center;
	}

	.kbd {
		font-family: var(--font-mono);
		font-size: 0.5rem;
		padding: 0.0625rem 0.1875rem;
		background: rgba(255,255,255,0.12);
		border-radius: var(--radius-xs);
		margin-left: 0.25rem;
	}

	/* ═══════════════════════════════════════════════════════════════
	   WARNING BANNER
	   ═══════════════════════════════════════════════════════════════ */
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

	/* Dependency chips for create mode */
	.dep-chips {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.5rem;
	}

	.dep-chip {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.3125rem 0.5rem;
		background: var(--bg-elevated);
		border-radius: 6px;
		font-size: 0.6875rem;
	}

	.dep-chip-id {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.5625rem;
		color: var(--text-tertiary);
	}

	.dep-chip-title {
		flex: 1;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dep-chip-x {
		background: none;
		border: none;
		color: var(--text-tertiary);
		font-size: 0.875rem;
		cursor: pointer;
		padding: 0;
		line-height: 1;
	}
	.dep-chip-x:hover { color: #ef4444; }

	/* ═══════════════════════════════════════════════════════════════
	   MOBILE
	   ═══════════════════════════════════════════════════════════════ */
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

		/* Compact header */
		.header {
			padding: 0.5rem 0.75rem;
		}

		.header-title {
			font-size: 0.875rem;
		}

		.btn-close {
			width: 1.5rem;
			height: 1.5rem;
		}

		.btn-close :global(svg) {
			width: 14px;
			height: 14px;
		}

		/* Compact body */
		.body {
			padding: 0.5rem 0.75rem;
			gap: 0.625rem;
		}

		.field {
			margin-bottom: 0;
		}

		.field-label {
			font-size: 0.5625rem;
			margin-bottom: 0.25rem;
		}

		.input-title {
			font-size: 1rem;
			padding: 0.375rem 0;
		}

		.input-desc {
			font-size: 0.75rem;
			padding: 0.375rem;
		}

		.pill-group {
			gap: 0.25rem;
		}

		.pill {
			padding: 0.25rem 0.5rem;
			font-size: 0.625rem;
		}

		.pill-dot {
			width: 5px;
			height: 5px;
		}

		/* Compact sections */
		.section-header {
			padding: 0.375rem 0;
			font-size: 0.625rem;
		}

		/* Compact comments */
		.comment {
			padding: 0.5rem;
		}

		.comment-author {
			font-size: 0.625rem;
		}

		.comment-time {
			font-size: 0.5rem;
		}

		.comment-text {
			font-size: 0.6875rem;
		}

		/* Compact footer */
		.footer {
			flex-direction: column;
			padding: 0.5rem 0.75rem;
			gap: 0.375rem;
		}

		.btn-secondary, .btn-primary, .btn-danger {
			width: 100%;
			justify-content: center;
			height: 2.25rem;
			font-size: 0.75rem;
		}

		/* Compact dependency chips */
		.dep-chips {
			gap: 0.25rem;
		}

		.dep-chip {
			padding: 0.25rem 0.375rem;
			font-size: 0.5625rem;
			gap: 0.25rem;
		}

		/* Compact attachment grid */
		.attachments-grid {
			gap: 0.375rem;
		}

		.attachment-item {
			padding: 0.375rem;
		}

		.attachment-name {
			font-size: 0.625rem;
		}

		.attachment-size {
			font-size: 0.5rem;
		}
	}

	@media (min-width: 1400px) {
		.panel { flex: 0 0 480px; min-width: 480px; max-width: 480px; }
	}

	@media (min-width: 1800px) {
		.panel { flex: 0 0 520px; min-width: 520px; max-width: 520px; }
	}
</style>
