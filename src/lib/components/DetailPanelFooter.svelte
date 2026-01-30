<script lang="ts">
	import type { Issue } from '$lib/types';
	import Icon from './Icon.svelte';

	interface Props {
		mode: 'create' | 'edit';
		// Create mode
		agentEnabled?: boolean;
		oncreate?: () => void;
		oncreateandstartagent?: () => void;
		onclose: () => void;
		// Edit mode
		editingIssue?: Issue | null;
		originalLabels?: string[];
		onstartagent?: (issue: Issue) => void;
		onsave?: (id: string, updates: Partial<Issue>) => void;
		ondelete?: (id: string) => void;
	}

	let {
		mode,
		agentEnabled = true,
		oncreate,
		oncreateandstartagent,
		onclose,
		editingIssue,
		originalLabels = [],
		onstartagent,
		onsave,
		ondelete,
	}: Props = $props();

	function handleSave() {
		if (!editingIssue || !onsave) return;
		const cur = editingIssue.labels || [];
		const add = cur.filter(l => !originalLabels.includes(l));
		const rm = originalLabels.filter(l => !cur.includes(l));
		onsave(editingIssue.id, { ...editingIssue, addLabels: add, removeLabels: rm } as any);
		onclose();
	}
</script>

{#if mode === 'create'}
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
	<footer class="footer">
		<button class="btn-danger" onclick={() => ondelete?.(editingIssue.id)}><Icon name="trash" size={13} />Delete</button>
		<div class="footer-actions">
			{#if agentEnabled && onstartagent && editingIssue.status !== 'closed'}
				<button class="btn-agent" onclick={() => onstartagent(editingIssue)} title="Start agent to work on this issue">
					<Icon name="agent" size={14} />Start Agent
				</button>
			{/if}
			<button class="btn-primary" onclick={handleSave}>Save</button>
		</div>
	</footer>
{/if}

<style>
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

	.footer-create { flex-wrap: wrap; }

	.footer-actions {
		display: flex;
		gap: 0.375rem;
		align-items: center;
	}

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

	.kbd {
		font-family: var(--font-mono);
		font-size: 0.5rem;
		padding: 0.0625rem 0.1875rem;
		background: rgba(255,255,255,0.12);
		border-radius: var(--radius-xs);
		margin-left: 0.25rem;
	}

	:global(.app.light) .kbd { background: rgba(0, 0, 0, 0.08); }

	@media (max-width: 768px) {
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
	}
</style>
