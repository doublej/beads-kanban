<script lang="ts">
	import Icon from './Icon.svelte';
	import PromptsList from './PromptsList.svelte';

	interface Props {
		show: boolean;
	}

	let { show = $bindable() }: Props = $props();

	let activeTab = $state(0);

	const prompts = [
		{
			title: 'Ticket Workflow',
			description: 'MANDATORY sequence for working on each ticket',
			prompt: `FOR EACH TICKET, follow this EXACT sequence:

1. CLAIM - Update ticket to in_progress BEFORE starting work:
   mcp__beads-agent__update_issue({ id: "<ticket-id>", status: "in_progress" })

2. WORK - Implement the changes

3. COMMIT - Create atomic commit with ticket reference:
   git add <files> && git commit -m "<type>(<ticket-id>): <description>"

4. LINT - Run linting and fix any issues BEFORE closing:
   bun run check
   - If errors: fix them, commit fixes, re-run lint
   - Only proceed to CLOSE when lint passes

5. CLOSE - Update ticket with summary, commit ID, and hash:
   git log -1 --format="%H %s"
   mcp__beads-agent__update_issue({
     id: "<ticket-id>",
     status: "closed",
     notes: "Summary: <what was done>\\nCommit: <hash> <message>"
   })

NEVER:
- Start work without claiming (updating to in_progress)
- Move to next ticket before committing current work
- Close ticket without running lint and ensuring it passes
- Close ticket without recording commit info`
		},
		{
			title: 'Start a work session',
			description: 'Begin working on the highest priority ready ticket',
			prompt: 'Check beads for ready tickets using `bd ready`. Pick the highest priority one, claim it with `bd update <id> --status in_progress --assignee claude`, and begin implementing.'
		},
		{
			title: 'Create a feature ticket',
			description: 'Add a new feature to the backlog with design notes',
			prompt: 'Create a new feature ticket: `bd create "Feature title" --type feature --priority 2`. Add design notes if needed with `bd update <id> --design "Technical approach..."'
		},
		{
			title: 'Report a bug',
			description: 'Log a bug with reproduction steps',
			prompt: 'Create a bug ticket: `bd create "Bug description" --type bug --priority 1`. Include reproduction steps in the description.'
		},
		{
			title: 'Add a dependency',
			description: 'Link issues to show blocking relationships',
			prompt: 'Link issues with dependencies: `bd dep add <blocked-id> <blocker-id>`. The first issue is blocked by the second.'
		},
		{
			title: 'Complete a ticket',
			description: 'Close an issue when implementation is done',
			prompt: 'When done implementing, close the ticket: `bd close <id> --reason "Implementation complete"`. Verify your work first!'
		},
		{
			title: 'Check blocked items',
			description: 'See what issues are waiting on dependencies',
			prompt: 'See what\'s blocked: `bd blocked`. This shows issues waiting on dependencies.'
		},
		{
			title: 'Project overview',
			description: 'Get statistics about the project state',
			prompt: 'Get project stats: `bd stats`. Shows total, open, in-progress, blocked, and completed counts.'
		},
		{
			title: 'Search issues',
			description: 'Find issues by text or filter by status',
			prompt: 'Find issues by text: `bd search "keyword"`. Use filters: `bd list --status open --priority 1`'
		}
	];

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			show = false;
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeTab = (activeTab + 1) % prompts.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeTab = (activeTab - 1 + prompts.length) % prompts.length;
		}
	}
</script>

<svelte:window onkeydown={show ? handleKeydown : undefined} />

{#if show}
<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
<aside class="prompts-window" role="dialog" aria-label="Prompts" tabindex="-1" onclick={(e) => e.stopPropagation()}>
		<header class="prompts-header">
			<div class="prompts-title-row">
				<span class="prompts-icon"><Icon name="message" size={18} /></span>
				<h2>Prompts</h2>
			</div>
			<button class="prompts-close" onclick={() => show = false} aria-label="Close prompts">
				<Icon name="close" size={16} />
			</button>
		</header>

		<div class="prompts-body">
			<PromptsList
				{prompts}
				{activeTab}
				onselect={(i) => activeTab = i}
			/>
		</div>

	<footer class="prompts-footer">
		<div class="footer-hint">
			<kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate
			<kbd>Esc</kbd> close
		</div>
	</footer>
</aside>
{/if}

<style>
	.prompts-window {
		position: absolute;
		top: 0;
		right: 340px;
		bottom: 0;
		width: 480px;
		max-width: calc(100vw - 340px);
		background: var(--bg-primary);
		border-right: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		animation: slideIn 280ms cubic-bezier(0.32, 0.72, 0, 1);
		box-shadow: -8px 0 32px rgba(0, 0, 0, 0.3);
	}

	@keyframes slideIn {
		from { transform: translateX(100%); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}

	.prompts-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
		background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
	}

	:global(.app.light) .prompts-header {
		background: linear-gradient(180deg, rgba(0,0,0,0.01) 0%, transparent 100%);
	}

	.prompts-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.prompts-icon {
		display: flex;
		opacity: 0.6;
	}

	.prompts-header h2 {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.prompts-close {
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
		transition: all 150ms ease;
	}

	.prompts-close:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
	}

	:global(.app.light) .prompts-close:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	.prompts-body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.prompts-footer {
		padding: 0.75rem 1.25rem;
		border-top: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .prompts-footer {
		background: rgba(0, 0, 0, 0.02);
	}

	.footer-hint {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	.footer-hint kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5625rem;
		font-weight: 500;
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}

	:global(.app.light) .footer-hint kbd {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.08);
	}

	@media (max-width: 820px) {
		.prompts-window {
			right: 0;
			width: 100%;
			max-width: none;
			border-right: none;
		}
	}

	@media (max-width: 640px) {
		.prompts-body {
			flex-direction: column;
		}
	}
</style>
