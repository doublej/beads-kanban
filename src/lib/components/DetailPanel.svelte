<script lang="ts">
	import type { Issue, Comment } from '$lib/types';
	import { getPriorityConfig, getTypeIcon, getDepTypeConfig, formatDate, getIssueColumn, columns } from '$lib/utils';

	interface Props {
		editingIssue: Issue | null;
		isCreating: boolean;
		createForm: { title: string; description: string; priority: number; issue_type: string };
		comments: Comment[];
		copiedId: string | null;
		newLabelInput: string;
		newComment: string;
		loadingComments: boolean;
		originalLabels: string[];
		isPanelDragging: boolean;
		panelDragOffset: number;
		onclose: () => void;
		oncreate: () => void;
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
	}

	let {
		editingIssue = $bindable(),
		isCreating,
		createForm = $bindable(),
		comments,
		copiedId,
		newLabelInput = $bindable(),
		newComment = $bindable(),
		loadingComments,
		originalLabels,
		isPanelDragging,
		panelDragOffset,
		onclose,
		oncreate,
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
		updatenewcomment
	}: Props = $props();
</script>

<aside
	class="panel open"
	class:dragging={isPanelDragging}
	style={panelDragOffset > 0 ? `transform: translateY(${panelDragOffset}px); opacity: ${1 - panelDragOffset / 200}` : ''}
	ontouchstart={onpaneltouchstart}
	ontouchmove={onpaneltouchmove}
	ontouchend={onpaneltouchend}
>
	<div class="panel-drag-handle"></div>
	{#if isCreating}
		<div class="panel-header">
			<h2>New Issue</h2>
			<button class="panel-close" onclick={onclose} aria-label="Close panel">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12"/>
				</svg>
				<kbd class="hotkey-hint hotkey-hint-close">esc</kbd>
			</button>
		</div>
		<div class="panel-body">
			<div class="form-group">
				<label for="create-title">Title</label>
				<input
					id="create-title"
					type="text"
					bind:value={createForm.title}
					placeholder="What needs to be done?"
				/>
			</div>
			<div class="form-group">
				<label for="create-desc">Description</label>
				<textarea
					id="create-desc"
					bind:value={createForm.description}
					rows="6"
					placeholder="Add details, context, acceptance criteria..."
				></textarea>
			</div>
			<div class="form-group">
				<label for="create-priority">Priority</label>
				<div class="priority-options">
					{#each [0, 1, 2, 3, 4] as p}
						{@const config = getPriorityConfig(p)}
						<button
							type="button"
							class="priority-option"
							class:selected={createForm.priority === p}
							style="--priority-color: {config.color}"
							onclick={() => updatecreateform('priority', p)}
						>
							<span class="priority-dot"></span>
							{config.label}
						</button>
					{/each}
				</div>
			</div>
			<div class="form-group">
				<label for="create-type">Type</label>
				<div class="type-options">
					{#each ['task', 'bug', 'feature', 'epic', 'chore'] as t}
						<button
							type="button"
							class="type-option"
							class:selected={createForm.issue_type === t}
							onclick={() => updatecreateform('issue_type', t)}
						>
							<span class="type-icon">{getTypeIcon(t)}</span>
							{t}
						</button>
					{/each}
				</div>
			</div>
		</div>
		<div class="panel-footer">
			<button class="btn-secondary" onclick={onclose}>Cancel <kbd class="btn-hotkey-subtle">Esc</kbd></button>
			<button class="btn-create" onclick={oncreate}>
				<span class="btn-create-icon">+</span>
				Create Issue
				<kbd class="btn-hotkey">⌘↵</kbd>
			</button>
		</div>
	{:else if editingIssue}
		{@const priorityConfig = getPriorityConfig(editingIssue.priority)}
		<div class="panel-header">
			<div class="panel-header-info">
				<span class="panel-id-wrap">
					<span class="panel-id">{editingIssue.id}</span>
					<button
						class="btn-copy panel-copy"
						class:copied={copiedId === `panel-${editingIssue.id}`}
						onclick={() => oncopyid(editingIssue.id, `panel-${editingIssue.id}`)}
						aria-label="Copy ID"
					>
						{#if copiedId === `panel-${editingIssue.id}`}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
						{/if}
					</button>
				</span>
				<div class="panel-status-bar" style="background: {priorityConfig.color}"></div>
			</div>
			<button class="panel-close" onclick={onclose} aria-label="Close panel">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12"/>
				</svg>
				<kbd class="hotkey-hint hotkey-hint-close">esc</kbd>
			</button>
		</div>
		<div class="panel-body">
			<div class="form-group">
				<label for="edit-title">Title</label>
				<input id="edit-title" type="text" bind:value={editingIssue.title} />
			</div>
			<div class="form-group">
				<label for="edit-desc" class="label-with-action">
					Description
					{#if editingIssue.description}
						<button
							class="btn-copy-inline"
							class:copied={copiedId === `desc-${editingIssue.id}`}
							onclick={() => oncopyid(editingIssue.description, `desc-${editingIssue.id}`)}
							aria-label="Copy description"
						>
							{#if copiedId === `desc-${editingIssue.id}`}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
								copied
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
								copy
							{/if}
						</button>
					{/if}
				</label>
				<textarea id="edit-desc" bind:value={editingIssue.description} rows="6"></textarea>
			</div>
			<div class="form-group">
				<label>Status</label>
				<div class="status-options">
					{#each columns as col}
						<button
							type="button"
							class="status-option"
							class:selected={getIssueColumn(editingIssue).key === col.key}
							style="--status-color: {col.accent}"
							onclick={() => onsetcolumn(col.key)}
						>
							<span class="status-icon">{col.icon}</span>
							{col.label}
						</button>
					{/each}
				</div>
			</div>
			<div class="form-group">
				<label>Priority</label>
				<div class="priority-options">
					{#each [0, 1, 2, 3, 4] as p}
						{@const config = getPriorityConfig(p)}
						<button
							type="button"
							class="priority-option"
							class:selected={editingIssue.priority === p}
							style="--priority-color: {config.color}"
							onclick={() => editingIssue.priority = p as 0 | 1 | 2 | 3 | 4}
						>
							<span class="priority-dot"></span>
							{config.label}
						</button>
					{/each}
				</div>
			</div>
			<div class="form-group">
				<label>Type</label>
				<div class="type-options">
					{#each ['task', 'bug', 'feature', 'epic', 'chore'] as t}
						<button
							type="button"
							class="type-option"
							class:selected={editingIssue.issue_type === t}
							onclick={() => editingIssue.issue_type = t}
						>
							<span class="type-icon">{getTypeIcon(t)}</span>
							{t}
						</button>
					{/each}
				</div>
			</div>
			{#if editingIssue.design || editingIssue._showDesign}
				<div class="form-group expandable">
					<label for="edit-design">
						Design Notes
						<button class="btn-collapse" onclick={() => { editingIssue.design = ''; editingIssue._showDesign = false; }} aria-label="Remove section">×</button>
					</label>
					<textarea id="edit-design" bind:value={editingIssue.design} rows="3" placeholder="Technical approach, architecture decisions..."></textarea>
				</div>
			{/if}
			{#if editingIssue.acceptance_criteria || editingIssue._showAcceptance}
				<div class="form-group expandable">
					<label for="edit-acceptance">
						Acceptance Criteria
						<button class="btn-collapse" onclick={() => { editingIssue.acceptance_criteria = ''; editingIssue._showAcceptance = false; }} aria-label="Remove section">×</button>
					</label>
					<textarea id="edit-acceptance" bind:value={editingIssue.acceptance_criteria} rows="3" placeholder="Definition of done, test cases..."></textarea>
				</div>
			{/if}
			{#if editingIssue.notes || editingIssue._showNotes}
				<div class="form-group expandable">
					<label for="edit-notes">
						Implementation Notes
						<button class="btn-collapse" onclick={() => { editingIssue.notes = ''; editingIssue._showNotes = false; }} aria-label="Remove section">×</button>
					</label>
					<textarea id="edit-notes" bind:value={editingIssue.notes} rows="3" placeholder="Progress updates, blockers, learnings..."></textarea>
				</div>
			{/if}
			{#if !editingIssue.design && !editingIssue._showDesign || !editingIssue.acceptance_criteria && !editingIssue._showAcceptance || !editingIssue.notes && !editingIssue._showNotes}
				<div class="add-sections">
					{#if !editingIssue.design && !editingIssue._showDesign}
						<button class="btn-add-section" onclick={() => editingIssue._showDesign = true}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
							Design
						</button>
					{/if}
					{#if !editingIssue.acceptance_criteria && !editingIssue._showAcceptance}
						<button class="btn-add-section" onclick={() => editingIssue._showAcceptance = true}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
							Acceptance
						</button>
					{/if}
					{#if !editingIssue.notes && !editingIssue._showNotes}
						<button class="btn-add-section" onclick={() => editingIssue._showNotes = true}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
							Notes
						</button>
					{/if}
				</div>
			{/if}
			<div class="form-group">
				<label>Labels</label>
				<div class="label-editor">
					{#if editingIssue.labels && editingIssue.labels.length > 0}
						<div class="label-chips">
							{#each editingIssue.labels as label}
								<span class="label-chip">
									{label}
									<button class="label-remove" onclick={() => onremovelabel(label)} aria-label="Remove {label}">×</button>
								</span>
							{/each}
						</div>
					{/if}
					<div class="label-input-wrap">
						<input
							type="text"
							class="label-input"
							placeholder="Add label..."
							bind:value={newLabelInput}
							onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onaddlabel(newLabelInput); } }}
						/>
						<button class="label-add-btn" onclick={() => onaddlabel(newLabelInput)} disabled={!newLabelInput.trim()}>+</button>
					</div>
				</div>
			</div>
			{#if editingIssue.dependencies && editingIssue.dependencies.length > 0}
				<div class="form-group">
					<label>Related Beads</label>
					<div class="dep-list">
						{#each editingIssue.dependencies as dep}
							{@const depConfig = getDepTypeConfig(dep.dependency_type)}
							<div class="dep-item blocked-by">
								<span class="dep-type-badge" style="background: {depConfig.color}20; color: {depConfig.color}" title="{depConfig.label}">{depConfig.icon}</span>
								<span class="dep-status" class:open={dep.status === 'open'} class:in-progress={dep.status === 'in_progress'} class:closed={dep.status === 'closed'}></span>
								<span class="dep-id">{dep.id}</span>
								<span class="dep-title">{dep.title}</span>
								<button class="dep-remove" onclick={() => onremovedep(editingIssue.id, dep.id)} title="Remove dependency">×</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
			{#if editingIssue.dependents && editingIssue.dependents.length > 0}
				<div class="form-group">
					<label>Related Beads</label>
					<div class="dep-list">
						{#each editingIssue.dependents as dep}
							{@const depConfig = getDepTypeConfig(dep.dependency_type)}
							<div class="dep-item blocking">
								<span class="dep-type-badge" style="background: {depConfig.color}20; color: {depConfig.color}" title="{depConfig.label}">{depConfig.icon}</span>
								<span class="dep-status" class:open={dep.status === 'open'} class:in-progress={dep.status === 'in_progress'} class:closed={dep.status === 'closed'}></span>
								<span class="dep-id">{dep.id}</span>
								<span class="dep-title">{dep.title}</span>
								<button class="dep-remove" onclick={() => onremovedep(dep.id, editingIssue.id)} title="Remove dependency">×</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
			<div class="form-group">
				<label>Comments {#if loadingComments}<span class="loading-indicator">...</span>{/if}</label>
				<div class="comments-section">
					{#if comments.length > 0}
						<div class="comments-list">
							{#each comments as comment}
								<div class="comment">
									<div class="comment-header">
										<span class="comment-author">{comment.author}</span>
										<span class="comment-date">{formatDate(comment.created_at)}</span>
									</div>
									<p class="comment-text">{comment.text}</p>
								</div>
							{/each}
						</div>
					{:else if !loadingComments}
						<p class="no-comments">No comments yet</p>
					{/if}
					<div class="comment-input">
						<textarea
							bind:value={newComment}
							rows="2"
							placeholder="Add a comment..."
							onkeydown={(e) => { if (e.key === 'Enter' && e.metaKey) onaddcomment(); }}
						></textarea>
						<button class="btn-comment" onclick={onaddcomment} disabled={!newComment.trim()}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>
		<div class="panel-footer">
			<button class="btn-danger" onclick={() => ondelete(editingIssue.id)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
				</svg>
				Delete
			</button>
			<button class="btn-primary" onclick={() => {
				const currentLabels = editingIssue.labels || [];
				const addLabels = currentLabels.filter(l => !originalLabels.includes(l));
				const removeLabels = originalLabels.filter(l => !currentLabels.includes(l));
				onsave(editingIssue.id, { ...editingIssue, addLabels, removeLabels } as any);
				onclose();
			}}>
				Save Changes
			</button>
		</div>
	{/if}
</aside>

<style>
	/* Panel - Inline between columns */
	.panel {
		position: relative;
		flex: 0 0 460px;
		min-width: 460px;
		max-width: 460px;
		background: var(--bg-secondary);
		border: none;
		border-radius: var(--radius-xl);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: var(--shadow-lg);
		animation: panelSlideIn 350ms cubic-bezier(0.25, 0.1, 0.25, 1);
	}

	@keyframes panelSlideIn {
		0% {
			opacity: 0;
			transform: scale(0.96) translateX(-16px);
			filter: blur(4px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateX(0);
			filter: blur(0);
		}
	}

	.panel-drag-handle {
		display: none;
	}


	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.125rem 1.5rem;
		border-bottom: 0.5px solid var(--border-subtle);
		background: transparent;
		flex-shrink: 0;
	}

	.panel-header h2 {
		font-size: 1.0625rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.panel-header-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.panel-id-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.panel-id {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.btn-copy.panel-copy {
		opacity: 0.6;
		width: 1.125rem;
		height: 1.125rem;
		background: transparent;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
	}

	.btn-copy.panel-copy svg {
		width: 0.75rem;
		height: 0.75rem;
	}

	.btn-copy.panel-copy:hover {
		opacity: 1;
	}

	.btn-copy.panel-copy.copied {
		color: #10b981;
	}

	.label-with-action {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.btn-copy-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		font-size: 0.625rem;
		cursor: pointer;
		padding: 0.125rem 0.375rem;
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
	}

	.btn-copy-inline svg {
		width: 0.625rem;
		height: 0.625rem;
	}

	.btn-copy-inline:hover {
		color: var(--text-secondary);
		background: var(--bg-tertiary);
	}

	.btn-copy-inline.copied {
		color: #10b981;
	}

	.panel-status-bar {
		width: 3px;
		height: 1.25rem;
		border-radius: 2px;
	}

	.panel-close {
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
		position: relative;
	}

	.panel-close svg {
		width: 1rem;
		height: 1rem;
	}

	.panel-close:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.panel-body {
		flex: 1;
		padding: 1.25rem;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.panel-footer {
		display: flex;
		gap: 0.625rem;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(255, 255, 255, 0.02);
		flex-shrink: 0;
	}

	:global(.app.light) .panel-footer {
		border-top-color: rgba(0, 0, 0, 0.04);
		background: rgba(0, 0, 0, 0.02);
	}

	/* Form Groups */
	.form-group {
		margin-bottom: 1.25rem;
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	.form-group label {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 0.625rem 0.875rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.875rem;
		transition: all var(--transition-fast);
	}

	:global(.app.light) .form-group input,
	:global(.app.light) .form-group textarea {
		background: rgba(255, 255, 255, 0.8);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.form-group input::placeholder,
	.form-group textarea::placeholder {
		color: var(--text-tertiary);
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(10, 132, 255, 0.5);
		box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.1);
	}

	:global(.app.light) .form-group input:focus,
	:global(.app.light) .form-group textarea:focus {
		background: rgba(255, 255, 255, 0.95);
		border-color: rgba(0, 122, 255, 0.5);
		box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 100px;
		line-height: 1.5;
	}

	/* Label Editor */
	.label-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.label-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.label-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: var(--bg-elevated);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.label-remove {
		background: none;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		padding: 0;
		font-size: 0.875rem;
		line-height: 1;
		transition: color var(--transition-fast);
	}

	.label-remove:hover {
		color: #ef4444;
	}

	.label-input-wrap {
		display: flex;
		gap: 0.5rem;
	}

	.label-input {
		flex: 1;
		padding: 0.5rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	.label-add-btn {
		padding: 0.5rem 0.75rem;
		background: var(--accent-primary);
		border: none;
		border-radius: var(--radius-sm);
		color: white;
		font-weight: 600;
		cursor: pointer;
		transition: opacity var(--transition-fast);
	}

	.label-add-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Dependency List */
	.dep-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.dep-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		font-size: 0.75rem;
	}

	.dep-item.blocked-by {
		border-left: 3px solid #ef4444;
	}

	.dep-item.blocking {
		border-left: 3px solid #10b981;
	}

	.dep-status {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-tertiary);
		flex-shrink: 0;
	}

	.dep-status.open {
		background: #6366f1;
	}

	.dep-status.in-progress {
		background: #f59e0b;
	}

	.dep-status.closed {
		background: #10b981;
	}

	.dep-id {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.dep-title {
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	.dep-remove {
		background: none;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		padding: 0;
		font-size: 0.875rem;
		line-height: 1;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.dep-item:hover .dep-remove {
		opacity: 1;
	}

	.dep-remove:hover {
		color: #ef4444;
	}

	.dep-type-badge {
		padding: 0.125rem 0.25rem;
		border-radius: var(--radius-sm);
		font-size: 0.625rem;
		font-weight: 600;
		flex-shrink: 0;
	}

	/* Comments */
	.comments-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.comments-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 200px;
		overflow-y: auto;
	}

	.comment {
		padding: 0.625rem 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}

	.comment-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}

	.comment-author {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--accent-primary);
	}

	.comment-date {
		font-size: 0.625rem;
		color: var(--text-tertiary);
	}

	.comment-text {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		line-height: 1.45;
		white-space: pre-wrap;
	}

	.no-comments {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		text-align: center;
		padding: 1rem;
	}

	.comment-input {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}

	.comment-input textarea {
		flex: 1;
		min-height: 60px;
		resize: none;
	}

	.btn-comment {
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-primary);
		border: none;
		border-radius: var(--radius-md);
		color: white;
		cursor: pointer;
		transition: all var(--transition-fast);
		flex-shrink: 0;
	}

	.btn-comment:hover:not(:disabled) {
		background: #4f46e5;
		transform: translateY(-1px);
	}

	.btn-comment:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-comment svg {
		width: 1rem;
		height: 1rem;
	}

	.loading-indicator {
		color: var(--text-tertiary);
		font-weight: normal;
	}

	/* Expandable sections */
	.form-group.expandable label {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.btn-collapse {
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-size: 0.875rem;
		cursor: pointer;
		opacity: 0;
		transition: all var(--transition-fast);
	}

	.form-group.expandable:hover .btn-collapse {
		opacity: 1;
	}

	.btn-collapse:hover {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.add-sections {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding: 0.5rem 0;
	}

	.btn-add-section {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.625rem;
		background: transparent;
		border: 1px dashed var(--border-default);
		border-radius: var(--radius-md);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-add-section svg {
		width: 0.75rem;
		height: 0.75rem;
	}

	.btn-add-section:hover {
		border-color: var(--accent-primary);
		color: var(--accent-primary);
		background: var(--accent-glow);
	}

	/* Option Buttons */
	.status-options,
	.priority-options,
	.type-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.status-option,
	.priority-option,
	.type-option {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.4375rem 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
		text-transform: capitalize;
	}

	.status-option:hover,
	.priority-option:hover,
	.type-option:hover {
		border-color: var(--border-default);
		background: var(--bg-elevated);
	}

	.status-option.selected {
		border-color: var(--status-color);
		background: var(--status-color);
		color: white;
	}

	.priority-option.selected {
		border-color: var(--priority-color);
		color: var(--priority-color);
		background: rgba(0, 0, 0, 0.2);
	}

	:global(.app.light) .priority-option.selected {
		background: rgba(255, 255, 255, 0.8);
	}

	.type-option.selected {
		border-color: var(--accent-primary);
		color: var(--accent-primary);
	}

	.status-icon {
		font-size: 0.6875rem;
	}

	.priority-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--priority-color);
	}

	.type-icon {
		font-size: 0.75rem;
		opacity: 0.8;
	}

	/* Buttons */
	.btn-secondary,
	.btn-primary,
	.btn-danger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		border: none;
		border-radius: var(--radius-lg);
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-secondary {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.btn-secondary:hover {
		background: var(--bg-elevated);
	}

	.btn-secondary:active {
		transform: scale(0.98);
	}

	.btn-primary {
		background: var(--accent-primary);
		color: white;
	}

	.btn-primary:hover {
		filter: brightness(1.1);
	}

	.btn-primary:active {
		filter: brightness(0.95);
		transform: scale(0.98);
	}

	.btn-danger {
		background: rgba(255, 59, 48, 0.12);
		color: #ff3b30;
	}

	.btn-danger:hover {
		background: rgba(255, 59, 48, 0.18);
	}

	.btn-danger:active {
		transform: scale(0.98);
	}

	.btn-danger svg {
		width: 0.875rem;
		height: 0.875rem;
	}

	/* Hotkey hints */
	.hotkey-hint-close {
		position: absolute;
		right: -0.25rem;
		bottom: -0.25rem;
		font-size: 0.5rem;
		padding: 0.0625rem 0.1875rem;
		background: var(--bg-elevated);
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		opacity: 0;
		transition: opacity var(--transition-fast);
	}

	.panel-close:hover .hotkey-hint-close {
		opacity: 1;
	}

	.btn-hotkey-subtle {
		font-size: 0.625rem;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		margin-left: 0.25rem;
	}

	.btn-hotkey {
		font-size: 0.625rem;
		padding: 0.125rem 0.25rem;
		background: rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-xs);
		font-family: var(--font-mono);
		margin-left: 0.5rem;
	}

	.btn-create {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		background: var(--accent-primary);
		border: none;
		border-radius: var(--radius-lg);
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-create:hover {
		filter: brightness(1.1);
	}

	.btn-create-icon {
		font-size: 1rem;
		font-weight: 600;
	}

	/* Mobile Styles */
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
			max-height: 85vh;
			border-radius: var(--radius-xl) var(--radius-xl) 0 0;
			z-index: 100;
			animation: panelSlideUp 350ms cubic-bezier(0.32, 0.72, 0, 1);
			overflow: hidden;
			touch-action: pan-y;
			backdrop-filter: saturate(180%) blur(20px);
			-webkit-backdrop-filter: saturate(180%) blur(20px);
			background: rgba(39, 39, 42, 0.92);
			box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.4);
			padding-bottom: env(safe-area-inset-bottom);
		}

		.panel.dragging {
			animation: none;
			transition: none;
		}

		.panel-drag-handle {
			display: block;
			width: 2.25rem;
			height: 0.3125rem;
			background: rgba(255, 255, 255, 0.2);
			border-radius: 3px;
			margin: 0.625rem auto 0.25rem;
			transition: background 150ms ease;
		}

		.panel:active .panel-drag-handle,
		.panel.dragging .panel-drag-handle {
			background: rgba(255, 255, 255, 0.4);
		}

		@keyframes panelSlideUp {
			from {
				opacity: 0;
				transform: translateY(100%);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}

		.panel-footer {
			flex-direction: column;
		}

		.btn-secondary,
		.btn-primary,
		.btn-danger {
			width: 100%;
			justify-content: center;
			padding: 0.75rem;
		}
	}

	/* Wide screens */
	@media (min-width: 1400px) {
		.panel {
			flex: 0 0 520px;
			min-width: 520px;
			max-width: 520px;
		}
	}

	@media (min-width: 1800px) {
		.panel {
			flex: 0 0 560px;
			min-width: 560px;
			max-width: 560px;
		}
	}
</style>
