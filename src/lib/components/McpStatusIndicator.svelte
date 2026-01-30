<script lang="ts">
	/**
	 * Informational panel about MCP notification mode.
	 * The web app cannot detect MCP availability (it's a CLI tool),
	 * so we show an explanation instead of a misleading status dot.
	 */
</script>

<div class="mcp-info">
	<span class="mcp-icon">i</span>
	<span class="mcp-text">
		Notifications are delivered via the Consult User MCP server when an AI agent is connected.
	</span>
	<a
		class="mcp-link"
		href="https://doublej.github.io/consult-user-mcp/"
		target="_blank"
		rel="noopener noreferrer"
	>
		Learn more
	</a>
</div>

<style>
	.mcp-info {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(99, 102, 241, 0.08);
		border: 1px solid rgba(99, 102, 241, 0.15);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-top: 0.5rem;
	}

	.mcp-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: rgba(99, 102, 241, 0.2);
		color: var(--accent, #6366f1);
		font-size: 0.625rem;
		font-weight: 700;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.mcp-text {
		flex: 1;
		line-height: 1.4;
	}

	.mcp-link {
		color: var(--accent, #6366f1);
		text-decoration: none;
		font-weight: 500;
		font-size: 0.6875rem;
		white-space: nowrap;
		align-self: center;
	}

	.mcp-link:hover {
		text-decoration: underline;
	}
</style>
