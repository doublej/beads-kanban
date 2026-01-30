<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		agentEnabled: boolean;
		agentHost: string;
		agentPort: number;
		agentToolsExpanded: boolean;
		onopenPromptsEditor: () => void;
	}

	let {
		agentEnabled = $bindable(),
		agentHost = $bindable(),
		agentPort = $bindable(),
		agentToolsExpanded = $bindable(),
		onopenPromptsEditor
	}: Props = $props();
</script>

<section class="settings-section">
	<h3 class="section-label">Agent</h3>
	<div class="setting-row">
		<div class="setting-info">
			<span class="setting-name">Agent Features</span>
			<span class="setting-desc">Enable AI agent integration</span>
		</div>
		<button class="toggle-switch" onclick={() => agentEnabled = !agentEnabled}>
			<span class="toggle-track" class:active={agentEnabled}>
				<span class="toggle-thumb"></span>
			</span>
		</button>
	</div>

	{#if agentEnabled}
		<div class="agent-config">
			<div class="config-row">
				<label class="config-label">Host</label>
				<input
					type="text"
					class="config-input"
					bind:value={agentHost}
					placeholder="localhost"
				/>
			</div>
			<div class="config-row">
				<label class="config-label">Port</label>
				<input
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
			<button class="toggle-switch" onclick={() => agentToolsExpanded = !agentToolsExpanded}>
				<span class="toggle-track" class:active={agentToolsExpanded}>
					<span class="toggle-thumb"></span>
				</span>
			</button>
		</div>
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
</style>
