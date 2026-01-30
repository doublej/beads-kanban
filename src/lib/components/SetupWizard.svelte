<script lang="ts">
	import { browser } from '$app/environment';
	import Icon from './Icon.svelte';

	interface Props {
		show: boolean;
		isDarkMode: boolean;
		projectName: string;
		ontoggleTheme: () => void;
		oncomplete: () => void;
	}

	let {
		show = $bindable(),
		isDarkMode,
		projectName,
		ontoggleTheme,
		oncomplete
	}: Props = $props();

	let step = $state(0);
	const totalSteps = 4;

	function next() {
		if (step < totalSteps - 1) step++;
		else finish();
	}

	function back() {
		if (step > 0) step--;
	}

	function finish() {
		if (browser) localStorage.setItem('beads-wizard-complete', 'true');
		show = false;
		oncomplete();
	}

	function skip() {
		finish();
	}

	function handleOverlayClick() {
		skip();
	}

	function handleContentClick(e: MouseEvent) {
		e.stopPropagation();
	}
</script>

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="wizard-overlay" onclick={handleOverlayClick}>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="wizard" onclick={handleContentClick}>
			<div class="progress">
				{#each Array(totalSteps) as _, i}
					<div class="dot" class:active={i === step} class:done={i < step}></div>
				{/each}
			</div>

			<div class="step-content">
				{#if step === 0}
					<div class="step">
						<div class="step-icon welcome-icon">
							<Icon name="view-board" size={28} />
						</div>
						<h2>Welcome to Beads Kanban</h2>
						<p>A visual board for your Beads issues. Drag cards between columns, manage priorities, and track progress.</p>
					</div>
				{:else if step === 1}
					<div class="step">
						<div class="step-icon project-icon">
							<Icon name="folder" size={28} />
						</div>
						<h2>Your Project</h2>
						<p>Connected to <strong>{projectName || 'your project'}</strong>. Issues are read from the <code>.beads/</code> directory in your project root.</p>
						<div class="hint">Switch projects anytime from the header menu.</div>
					</div>
				{:else if step === 2}
					<div class="step">
						<div class="step-icon theme-icon">
							<Icon name={isDarkMode ? 'moon' : 'sun'} size={28} />
						</div>
						<h2>Pick a Theme</h2>
						<p>Currently using <strong>{isDarkMode ? 'dark' : 'light'}</strong> mode.</p>
						<button class="theme-toggle" onclick={ontoggleTheme}>
							<Icon name={isDarkMode ? 'sun' : 'moon'} size={14} />
							Switch to {isDarkMode ? 'light' : 'dark'}
						</button>
					</div>
				{:else if step === 3}
					<div class="step">
						<div class="step-icon ready-icon">
							<Icon name="check-circle" size={28} />
						</div>
						<h2>You're All Set</h2>
						<p>Create issues with <kbd>n</kbd>, navigate with arrow keys, and press <kbd>?</kbd> for all shortcuts.</p>
						<div class="hint">Open Settings anytime to configure notifications and agent integration.</div>
					</div>
				{/if}
			</div>

			<div class="actions">
				{#if step > 0}
					<button class="btn-back" onclick={back}>Back</button>
				{:else}
					<button class="btn-skip" onclick={skip}>Skip</button>
				{/if}
				<button class="btn-next" onclick={next}>
					{step === totalSteps - 1 ? 'Get Started' : 'Next'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.wizard-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
		animation: fadeIn 200ms ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.wizard {
		background: var(--bg-secondary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		padding: 1.5rem;
		max-width: 400px;
		width: 90%;
		box-shadow: var(--shadow-lg);
		animation: slideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(20px) scale(0.95); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.progress {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--border-subtle);
		transition: all 200ms ease;
	}

	.dot.active {
		background: var(--accent-primary);
		transform: scale(1.25);
	}

	.dot.done {
		background: var(--state-done, #10b981);
	}

	.step-content {
		min-height: 180px;
		display: flex;
		align-items: center;
	}

	.step {
		text-align: center;
		width: 100%;
	}

	.step-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 16px;
		margin-bottom: 1rem;
	}

	.welcome-icon {
		background: rgba(99, 102, 241, 0.15);
		color: #6366f1;
	}

	.project-icon {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	.theme-icon {
		background: rgba(139, 92, 246, 0.15);
		color: #8b5cf6;
	}

	.ready-icon {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.step h2 {
		font-size: 1.25rem;
		font-weight: 650;
		color: var(--text-primary);
		letter-spacing: -0.02em;
		margin-bottom: 0.5rem;
	}

	.step p {
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.step strong {
		color: var(--text-primary);
	}

	.step code {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.8125rem;
		background: rgba(255, 255, 255, 0.08);
		padding: 0.1em 0.35em;
		border-radius: 4px;
	}

	.step kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.3rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--text-primary);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-default);
		border-radius: 4px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.hint {
		margin-top: 0.75rem;
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.theme-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: 0.75rem;
		padding: 0.5rem 1rem;
		background: var(--surface-panel);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.theme-toggle:hover {
		border-color: var(--border-default);
		background: var(--surface-card);
	}

	.actions {
		display: flex;
		justify-content: space-between;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-subtle);
	}

	.btn-back, .btn-skip {
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.btn-back:hover, .btn-skip:hover {
		border-color: var(--border-default);
		color: var(--text-primary);
	}

	.btn-next {
		padding: 0.5rem 1.25rem;
		background: var(--accent-primary);
		border: none;
		border-radius: var(--radius-md);
		color: white;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.btn-next:hover {
		filter: brightness(1.1);
	}

	/* Light theme */
	:global(.app.light) .step code {
		background: rgba(0, 0, 0, 0.06);
	}
</style>
