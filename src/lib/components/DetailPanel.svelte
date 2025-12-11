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
