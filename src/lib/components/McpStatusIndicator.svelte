<script lang="ts">
	/**
	 * Displays MCP availability status.
	 * Since MCP tools are invoked by the AI agent, this shows
	 * informational status about the Consult User MCP server.
	 */
	let { available = false }: { available?: boolean } = $props();
</script>

<div class="mcp-status" class:available>
	<span class="mcp-dot"></span>
	<span class="mcp-label">
		{available ? 'MCP Connected' : 'MCP Unavailable'}
	</span>
	{#if !available}
		<a
			class="mcp-link"
			href="https://doublej.github.io/consult-user-mcp/"
			target="_blank"
			rel="noopener noreferrer"
		>
			Install
		</a>
	{/if}
</div>

<style>
	.mcp-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.15);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-top: 0.5rem;
	}

	.mcp-status.available {
		background: rgba(34, 197, 94, 0.08);
		border-color: rgba(34, 197, 94, 0.15);
	}

	.mcp-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ef4444;
		flex-shrink: 0;
	}

	.mcp-status.available .mcp-dot {
		background: #22c55e;
	}

	.mcp-label {
		flex: 1;
		font-weight: 500;
	}

	.mcp-link {
		color: var(--accent);
		text-decoration: none;
		font-weight: 500;
		font-size: 0.6875rem;
	}

	.mcp-link:hover {
		text-decoration: underline;
	}
</style>
