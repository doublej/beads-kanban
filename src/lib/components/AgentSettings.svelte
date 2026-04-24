<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		agentEnabled: boolean;
		agentHost: string;
		agentPort: number;
		agentModel: string;
		agentToolsExpanded: boolean;
		showAgentBar: boolean;
		conflictStrategy: 'ask' | 'worktree' | 'queue' | 'same';
		managerEnabled: boolean;
		managerModel: string;
		onopenPromptsEditor: () => void;
	}

	let {
		agentEnabled = $bindable(),
		agentHost = $bindable(),
		agentPort = $bindable(),
		agentModel = $bindable(),
		agentToolsExpanded = $bindable(),
		showAgentBar = $bindable(),
		conflictStrategy = $bindable(),
		managerEnabled = $bindable(),
		managerModel = $bindable(),
		onopenPromptsEditor
	}: Props = $props();

	const modelOptions = [
		{ value: '', label: 'Default', hint: 'CLI default model' },
		{ value: 'haiku', label: 'Haiku', hint: 'Fast & lightweight' },
		{ value: 'sonnet', label: 'Sonnet', hint: 'Balanced performance' },
		{ value: 'opus', label: 'Opus', hint: 'Most capable' },
	];
</script>

<section class="settings-section">
	<h3 class="section-label">Agent</h3>
	<div class="setting-row">
		<div class="setting-info">
			<span class="setting-name">Agent Features</span>
			<span class="setting-desc">Enable AI agent integration</span>
		</div>
		<button class="toggle-switch" onclick={() => agentEnabled = !agentEnabled} aria-label="Toggle agent features">
			<span class="toggle-track" class:active={agentEnabled}>
				<span class="toggle-thumb"></span>
			</span>
		</button>
	</div>

	<div class="setting-row" style="margin-top: 0.75rem">
		<div class="setting-info">
			<span class="setting-name">Show chat bar</span>
			<span class="setting-desc">Display the agent bar at the bottom</span>
		</div>
		<button class="toggle-switch" onclick={() => showAgentBar = !showAgentBar} aria-label="Toggle agent bar">
			<span class="toggle-track" class:active={showAgentBar}>
				<span class="toggle-thumb"></span>
			</span>
		</button>
	</div>

	{#if agentEnabled}
		<div class="agent-config">
			<div class="config-row">
				<label class="config-label" for="agent-host">Host</label>
				<input
					id="agent-host"
					type="text"
					class="config-input"
					bind:value={agentHost}
					placeholder="localhost"
				/>
			</div>
			<div class="config-row">
				<label class="config-label" for="agent-port">Port</label>
				<input
					id="agent-port"
					type="number"
					class="config-input config-input-port"
					bind:value={agentPort}
					placeholder="8765"
					min="1"
					max="65535"
				/>
			</div>
			<div class="config-endpoint">
				<span class="endpoint-label">Endpoint</span>
				<code class="endpoint-value">ws://{agentHost}:{agentPort}</code>
			</div>
		</div>

		<!-- Agent Model -->
		<div class="setting-row" style="margin-top: 0.75rem;">
			<div class="setting-info">
				<span class="setting-name">Model</span>
				<span class="setting-desc">Claude model for agent sessions</span>
			</div>
		</div>

		<div class="strategy-selector">
			{#each modelOptions as opt}
				<button
					class="strategy-option"
					class:active={agentModel === opt.value}
					onclick={() => agentModel = opt.value}
				>
					<span class="strategy-label">{opt.label}</span>
					<span class="strategy-hint">{opt.hint}</span>
				</button>
			{/each}
		</div>

		<!-- Agent Prompts -->
		<div class="setting-row" style="margin-top: 0.75rem">
			<div class="setting-info">
				<span class="setting-name">Agent Prompts</span>
				<span class="setting-desc">First message, system prompt & workflow</span>
			</div>
			<button class="btn-edit-prompts" onclick={onopenPromptsEditor}>
				<Icon name="edit" size={12} />
				<span>Edit</span>
			</button>
		</div>

		<!-- Tool Display Preference -->
		<div class="setting-row" style="margin-top: 0.75rem">
			<div class="setting-info">
				<span class="setting-name">Expand Tool Calls</span>
				<span class="setting-desc">Show tool input/output by default</span>
			</div>
			<button class="toggle-switch" onclick={() => agentToolsExpanded = !agentToolsExpanded} aria-label="Toggle tool call expansion">
				<span class="toggle-track" class:active={agentToolsExpanded}>
					<span class="toggle-thumb"></span>
				</span>
			</button>
		</div>

		<!-- Conflict Resolution Strategy -->
		<div class="setting-row" style="margin-top: 0.75rem;">
			<div class="setting-info">
				<span class="setting-name">Directory Conflicts</span>
				<span class="setting-desc">How to handle agent CWD conflicts</span>
			</div>
		</div>

		<div class="strategy-selector">
			<button
				class="strategy-option"
				class:active={conflictStrategy === 'ask'}
				onclick={() => conflictStrategy = 'ask'}
			>
				<span class="strategy-label">Ask every time</span>
				<span class="strategy-hint">Show dialog to choose</span>
			</button>

			<button
				class="strategy-option"
				class:active={conflictStrategy === 'worktree'}
				onclick={() => conflictStrategy = 'worktree'}
			>
				<span class="strategy-label">Always worktree</span>
				<span class="strategy-hint">Isolated copy (safest)</span>
			</button>

			<button
				class="strategy-option"
				class:active={conflictStrategy === 'queue'}
				onclick={() => conflictStrategy = 'queue'}
			>
				<span class="strategy-label">Always queue</span>
				<span class="strategy-hint">Wait for current agent</span>
			</button>

			<button
				class="strategy-option"
				class:active={conflictStrategy === 'same'}
				onclick={() => conflictStrategy = 'same'}
			>
				<span class="strategy-label">Use same CWD</span>
				<span class="strategy-hint">Shared directory (risk)</span>
			</button>
		</div>

		<!-- Manager Agent -->
		<div class="setting-row" style="margin-top: 1rem;">
			<div class="setting-info">
				<span class="setting-name" style="color: #f59e0b;">Manager Agent</span>
				<span class="setting-desc">Orchestrator that manages tickets and agents</span>
			</div>
			<button class="toggle-switch" onclick={() => managerEnabled = !managerEnabled} aria-label="Toggle manager agent">
				<span class="toggle-track" class:active={managerEnabled}>
					<span class="toggle-thumb"></span>
				</span>
			</button>
		</div>

		{#if managerEnabled}
			<div class="setting-row" style="margin-top: 0.5rem;">
				<div class="setting-info">
					<span class="setting-name">Manager Model</span>
					<span class="setting-desc">Model for the manager agent</span>
				</div>
			</div>
			<div class="strategy-selector">
				{#each modelOptions as opt}
					<button
						class="strategy-option"
						class:active={managerModel === opt.value}
						onclick={() => managerModel = opt.value}
					>
						<span class="strategy-label">{opt.label}</span>
						<span class="strategy-hint">{opt.hint}</span>
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</section>

<style>
	.settings-section {
		padding: 0.75rem 1.25rem;
	}

	.section-label {
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
		margin: 0 0 0.625rem 0;
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.setting-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.setting-desc {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	/* Toggle Switch */
	.toggle-switch {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.toggle-track {
		display: flex;
		align-items: center;
		width: 36px;
		height: 20px;
		padding: 2px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		transition: all 200ms ease;
	}

	.toggle-track.active {
		background: rgba(34, 211, 238, 0.2);
		border-color: rgba(34, 211, 238, 0.3);
	}

	:global(.app.light) .toggle-track {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .toggle-track.active {
		background: rgba(6, 182, 212, 0.15);
		border-color: rgba(6, 182, 212, 0.25);
	}

	.toggle-thumb {
		width: 14px;
		height: 14px;
		background: var(--text-tertiary);
		border-radius: 50%;
		transition: all 200ms ease;
	}

	.toggle-track.active .toggle-thumb {
		transform: translateX(16px);
		background: #22d3ee;
	}

	:global(.app.light) .toggle-track.active .toggle-thumb {
		background: #0891b2;
	}

	/* Agent Config */
	.agent-config {
		margin-top: 0.75rem;
		padding: 0.625rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: var(--radius-md);
	}

	:global(.app.light) .agent-config {
		background: rgba(0, 0, 0, 0.02);
		border-color: rgba(0, 0, 0, 0.04);
	}

	.config-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.config-label {
		width: 40px;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--text-tertiary);
	}

	.config-input {
		flex: 1;
		padding: 0.375rem 0.5rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
	}

	.config-input:focus {
		outline: none;
		border-color: rgba(34, 211, 238, 0.4);
	}

	.config-input-port {
		width: 70px;
		flex: none;
	}

	:global(.app.light) .config-input {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.config-endpoint {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
	}

	:global(.app.light) .config-endpoint {
		border-top-color: rgba(0, 0, 0, 0.04);
	}

	.endpoint-label {
		font-size: 0.625rem;
		color: var(--text-tertiary);
	}

	.endpoint-value {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		color: #22d3ee;
		background: rgba(34, 211, 238, 0.1);
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
	}

	:global(.app.light) .endpoint-value {
		color: #0891b2;
		background: rgba(6, 182, 212, 0.1);
	}

	/* Edit Prompts Button */
	.btn-edit-prompts {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.2);
		border-radius: var(--radius-sm);
		color: #60a5fa;
		font-family: inherit;
		font-size: 0.6875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.btn-edit-prompts:hover {
		background: rgba(59, 130, 246, 0.15);
		border-color: rgba(59, 130, 246, 0.3);
	}

	:global(.app.light) .btn-edit-prompts {
		background: rgba(59, 130, 246, 0.08);
		color: #2563eb;
	}

	:global(.app.light) .btn-edit-prompts:hover {
		background: rgba(59, 130, 246, 0.12);
	}

	/* Conflict Strategy Selector */
	.strategy-selector {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem 0 0 0;
	}

	.strategy-option {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 0.625rem 0.75rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-md);
		text-align: left;
		cursor: pointer;
		transition: all 180ms ease;
	}

	.strategy-option:hover {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.12);
	}

	.strategy-option.active {
		background: rgba(34, 211, 238, 0.12);
		border-color: rgba(34, 211, 238, 0.3);
	}

	.strategy-option.active:hover {
		background: rgba(34, 211, 238, 0.16);
		border-color: rgba(34, 211, 238, 0.4);
	}

	:global(.app.light) .strategy-option {
		background: rgba(0, 0, 0, 0.02);
		border-color: rgba(0, 0, 0, 0.06);
	}

	:global(.app.light) .strategy-option:hover {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.12);
	}

	:global(.app.light) .strategy-option.active {
		background: rgba(14, 165, 233, 0.12);
		border-color: rgba(14, 165, 233, 0.3);
	}

	:global(.app.light) .strategy-option.active:hover {
		background: rgba(14, 165, 233, 0.16);
	}

	.strategy-label {
		font-weight: 600;
		font-size: 0.8125rem;
		color: var(--text-primary);
	}

	.strategy-hint {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}
</style>
