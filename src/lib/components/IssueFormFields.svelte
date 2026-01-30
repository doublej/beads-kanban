<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getPriorityConfig, getTypeIcon, columns } from '$lib/utils';
	import Icon from './Icon.svelte';
	import IssueSearch from './IssueSearch.svelte';

	interface Props {
		mode: 'create' | 'edit';
		// Create mode props
		createForm?: { title: string; description: string; priority: number; issue_type: string; deps?: string[] };
		updatecreateform?: (key: string, value: any) => void;
		allIssues?: Issue[];
		// Edit mode props
		editingIssue?: Issue | null;
		column?: { key: string; label: string; icon: string; accent: string };
		activeAgents?: string[];
		onsetcolumn?: (columnKey: string) => void;
	}

	let {
		mode,
		createForm = $bindable(),
		updatecreateform,
		allIssues = [],
		editingIssue = $bindable(),
		column,
		activeAgents = [],
		onsetcolumn,
	}: Props = $props();

	function addDepToCreate(issue: Issue) {
		if (!createForm || !updatecreateform) return;
		const deps = createForm.deps || [];
		if (!deps.includes(issue.id)) updatecreateform('deps', [...deps, issue.id]);
	}

	function removeDepFromCreate(issueId: string) {
		if (!createForm || !updatecreateform) return;
		updatecreateform('deps', (createForm.deps || []).filter((id: string) => id !== issueId));
	}

	function getIssueById(id: string): Issue | undefined {
		return allIssues.find(i => i.id === id);
	}
</script>

{#if mode === 'create' && createForm && updatecreateform}
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

{:else if mode === 'edit' && editingIssue}
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
				<button class="pill pill-status" class:active={column?.key === col.key} style="--pill-color: {col.accent}" onclick={() => onsetcolumn?.(col.key)}>
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
				<option value={agent}></option>
			{/each}
		</datalist>
	</div>
{/if}

<style>
	.field { margin-bottom: 1rem; }
	.field-row { display: flex; gap: 1rem; }
	.field-half { flex: 1; }

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

	:global(.app.light) .input:focus,
	:global(.app.light) .input-title:focus,
	:global(.app.light) .input-desc:focus {
		background: rgba(0, 0, 0, 0.02);
	}

	/* Pill buttons */
	.pill-group { display: flex; flex-wrap: wrap; gap: 0.25rem; }
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

	.pill :global(svg) { flex-shrink: 0; margin-right: 0.375rem; }

	.pill-text {
		flex: 1;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global(.app.light) .pill.active { background: rgba(255,255,255,0.8); }
	:global(.app.light) .pill-status.active { background: var(--pill-color); }
	:global(.app.light) .pill { background: rgba(0, 0, 0, 0.04); border-color: var(--border-subtle); }
	:global(.app.light) .pill:hover { background: rgba(0, 0, 0, 0.06); }

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
	:global(.app.light) .btn-add { border-color: var(--border-default); }

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
		font-family: 'IBM Plex Mono', monospace;
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

	:global(.app.light) .dep-chip { background: rgba(0, 0, 0, 0.04); }

	.agent-hint { font-weight: 400; color: var(--text-tertiary); font-size: 0.5625rem; }

	@media (max-width: 768px) {
		.field { margin-bottom: 0; }
		.field-label { font-size: 0.5625rem; margin-bottom: 0.25rem; }
		.input-title { font-size: 1rem; padding: 0.375rem 0; }
		.input-desc { font-size: 0.75rem; padding: 0.375rem; }
		.pill-group { gap: 0.25rem; }
		.pill { padding: 0.25rem 0.5rem; font-size: 0.625rem; }
		.pill-dot { width: 5px; height: 5px; }
		.dep-chips { gap: 0.25rem; }
		.dep-chip { padding: 0.25rem 0.375rem; font-size: 0.5625rem; gap: 0.25rem; }
	}
</style>
