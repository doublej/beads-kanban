<script lang="ts">
	import type { ViewRecipe } from '$lib/types';
	import Icon from './Icon.svelte';

	interface Props {
		recipes: ViewRecipe[];
		currentRecipeId: string | null;
		hasUnsavedChanges: boolean;
		onsave: (name: string) => void;
		onapply: (recipe: ViewRecipe) => void;
		ondelete: (id: string) => void;
		onrename: (id: string, newName: string) => void;
	}

	let {
		recipes,
		currentRecipeId = $bindable(),
		hasUnsavedChanges,
		onsave,
		onapply,
		ondelete,
		onrename
	}: Props = $props();

	let showDropdown = $state(false);
	let showSaveDialog = $state(false);
	let saveDialogName = $state('');
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	function handleSave() {
		if (saveDialogName.trim()) {
			onsave(saveDialogName.trim());
			saveDialogName = '';
			showSaveDialog = false;
		}
	}

	function handleRename(id: string) {
		if (renameValue.trim()) {
			onrename(id, renameValue.trim());
			renamingId = null;
			renameValue = '';
		}
	}

	function startRename(recipe: ViewRecipe) {
		renamingId = recipe.id;
		renameValue = recipe.name;
	}

	const currentRecipe = $derived(recipes.find(r => r.id === currentRecipeId));
	const buttonLabel = $derived(currentRecipe ? currentRecipe.name : 'Default View');
</script>

<div class="recipe-picker">
	<button
		class="toolbar-btn recipe-btn"
		class:active={showDropdown}
		class:has-recipe={currentRecipeId !== null}
		onclick={() => showDropdown = !showDropdown}
		title="Saved Views"
	>
		<Icon name="folder" size={14} />
		<span class="recipe-label">{buttonLabel}</span>
		{#if hasUnsavedChanges}
			<span class="unsaved-dot" title="Unsaved changes"></span>
		{/if}
	</button>

	{#if showDropdown}
		<div class="dropdown" onclick={(e) => e.stopPropagation()}>
			<div class="dropdown-header">
				<span class="dropdown-title">Saved Views</span>
				<button
					class="save-current-btn"
					onclick={() => { showSaveDialog = true; showDropdown = false; }}
					title="Save current view"
				>
					<Icon name="save" size={12} />
					Save Current
				</button>
			</div>

			{#if recipes.length === 0}
				<div class="empty-state">
					No saved views yet. Configure filters and sorting, then click "Save Current" to create a view.
				</div>
			{:else}
				<div class="recipe-list">
					{#each recipes as recipe (recipe.id)}
						<div class="recipe-item" class:active={currentRecipeId === recipe.id}>
							{#if renamingId === recipe.id}
								<input
									class="rename-input"
									type="text"
									bind:value={renameValue}
									onkeydown={(e) => {
										if (e.key === 'Enter') handleRename(recipe.id);
										if (e.key === 'Escape') { renamingId = null; renameValue = ''; }
									}}
									onclick={(e) => e.stopPropagation()}
								/>
								<button class="icon-btn" onclick={() => handleRename(recipe.id)} title="Save">
									<Icon name="check" size={12} />
								</button>
								<button class="icon-btn" onclick={() => { renamingId = null; renameValue = ''; }} title="Cancel">
									<Icon name="close" size={12} />
								</button>
							{:else}
								<button class="recipe-name" onclick={() => { onapply(recipe); showDropdown = false; }}>
									{recipe.name}
								</button>
								<button class="icon-btn" onclick={() => startRename(recipe)} title="Rename">
									<Icon name="edit" size={12} />
								</button>
								<button class="icon-btn delete" onclick={() => ondelete(recipe.id)} title="Delete">
									<Icon name="trash" size={12} />
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if currentRecipeId}
				<div class="dropdown-footer">
					<button
						class="clear-btn"
						onclick={() => { currentRecipeId = null; showDropdown = false; }}
					>
						Clear Selection (Reset to Default)
					</button>
				</div>
			{/if}
		</div>
	{/if}

	{#if showSaveDialog}
		<div class="save-dialog-overlay" onclick={() => { showSaveDialog = false; saveDialogName = ''; }}>
			<div class="save-dialog" onclick={(e) => e.stopPropagation()}>
				<h3>Save Current View</h3>
				<input
					type="text"
					bind:value={saveDialogName}
					placeholder="Enter view name..."
					onkeydown={(e) => {
						if (e.key === 'Enter') handleSave();
						if (e.key === 'Escape') { showSaveDialog = false; saveDialogName = ''; }
					}}
				/>
				<div class="dialog-actions">
					<button class="btn-cancel" onclick={() => { showSaveDialog = false; saveDialogName = ''; }}>
						Cancel
					</button>
					<button class="btn-save" onclick={handleSave} disabled={!saveDialogName.trim()}>
						Save
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<svelte:window onclick={() => { showDropdown = false; }} />

<style>
	.recipe-picker {
		position: relative;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		height: 1.75rem;
		padding: 0 0.5rem;
		background: transparent;
		border: none;
		border-radius: 0.25rem;
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
		position: relative;
	}

	.toolbar-btn :global(svg) {
		flex-shrink: 0;
	}

	.recipe-label {
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.unsaved-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #f59e0b;
		margin-left: -2px;
	}

	.toolbar-btn:hover,
	.toolbar-btn.active {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.toolbar-btn.has-recipe {
		color: var(--accent-primary);
	}

	:global(.app.light) .toolbar-btn:hover,
	:global(.app.light) .toolbar-btn.active {
		background: rgba(0, 0, 0, 0.04);
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 0.5rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		min-width: 280px;
		max-width: 320px;
		z-index: 1000;
		overflow: hidden;
	}

	.dropdown-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem;
		border-bottom: 1px solid var(--border-primary);
	}

	.dropdown-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.save-current-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: var(--accent-primary);
		border: none;
		border-radius: 0.25rem;
		color: white;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.1s;
	}

	.save-current-btn:hover {
		opacity: 0.9;
	}

	.empty-state {
		padding: 1.5rem;
		text-align: center;
		color: var(--text-tertiary);
		font-size: 0.8125rem;
		line-height: 1.5;
	}

	.recipe-list {
		max-height: 300px;
		overflow-y: auto;
	}

	.recipe-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--border-primary);
		transition: background 0.1s;
	}

	.recipe-item:last-child {
		border-bottom: none;
	}

	.recipe-item:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.recipe-item.active {
		background: rgba(99, 102, 241, 0.1);
	}

	.recipe-name {
		flex: 1;
		text-align: left;
		padding: 0.25rem 0;
		background: none;
		border: none;
		color: var(--text-primary);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.recipe-item.active .recipe-name {
		color: var(--accent-primary);
	}

	.rename-input {
		flex: 1;
		padding: 0.25rem 0.5rem;
		background: var(--bg-primary);
		border: 1px solid var(--accent-primary);
		border-radius: 0.25rem;
		color: var(--text-primary);
		font-size: 0.8125rem;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 0.25rem;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
	}

	.icon-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.icon-btn.delete:hover {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
	}

	.dropdown-footer {
		padding: 0.5rem 0.75rem;
		border-top: 1px solid var(--border-primary);
	}

	.clear-btn {
		width: 100%;
		padding: 0.5rem;
		background: transparent;
		border: 1px solid var(--border-primary);
		border-radius: 0.25rem;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.1s;
	}

	.clear-btn:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.save-dialog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
	}

	.save-dialog {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 0.5rem;
		padding: 1.5rem;
		min-width: 320px;
		max-width: 400px;
	}

	.save-dialog h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.save-dialog input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: 0.25rem;
		color: var(--text-primary);
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.save-dialog input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.dialog-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.btn-cancel,
	.btn-save {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.25rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.1s;
	}

	.btn-cancel {
		background: transparent;
		color: var(--text-secondary);
		border: 1px solid var(--border-primary);
	}

	.btn-cancel:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.btn-save {
		background: var(--accent-primary);
		color: white;
	}

	.btn-save:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
