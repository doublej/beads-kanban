<script lang="ts">
	import type { Issue } from '$lib/types';

	interface Props {
		editingIssue: Issue;
		newLabelInput: string;
		onaddlabel: (label: string) => void;
		onremovelabel: (label: string) => void;
		updatenewlabel: (value: string) => void;
	}

	let {
		editingIssue,
		newLabelInput = $bindable(),
		onaddlabel,
		onremovelabel,
		updatenewlabel,
	}: Props = $props();
</script>

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

<style>
	.field { margin-bottom: 1rem; }

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

	.label-editor { display: flex; flex-direction: column; gap: 0.5rem; }
	.label-chips { display: flex; flex-wrap: wrap; gap: 0.25rem; }

	.label-chip {
		padding: 0.1875rem 0.5rem;
		background: var(--bg-elevated);
		border-radius: 6px;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

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

	.input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: rgba(255,255,255,0.04);
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.8125rem;
		transition: all 150ms ease;
	}
	.input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px var(--accent-glow);
	}
	.input::placeholder { color: var(--text-tertiary); }
	.input-sm { padding: 0.375rem 0.625rem; font-size: 0.75rem; }

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

	:global(.app.light) .label-chip { background: rgba(0, 0, 0, 0.04); }

	:global(.app.light) .input {
		background: rgba(255,255,255,0.8);
		border-color: rgba(0,0,0,0.08);
	}

	:global(.app.light) .input:focus {
		background: rgba(0, 0, 0, 0.02);
	}
</style>
