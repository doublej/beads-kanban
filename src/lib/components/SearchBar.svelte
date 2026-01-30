<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		searchQuery: string;
		onopenCreatePanel: () => void;
		onfocuschange?: (focused: boolean) => void;
	}

	let {
		searchQuery = $bindable(),
		onopenCreatePanel,
		onfocuschange
	}: Props = $props();
</script>

<div class="search-container">
	<span class="search-icon"><Icon name="search" size={13} /></span>
	<input
		type="text"
		placeholder="Search..."
		bind:value={searchQuery}
		class="search-input"
		onfocus={() => onfocuschange?.(true)}
		onblur={() => onfocuschange?.(false)}
	/>
	{#if searchQuery}
		<button class="search-clear" onclick={() => searchQuery = ''}>×</button>
	{:else}
		<kbd class="hotkey-hint">⌘K</kbd>
	{/if}
</div>

<button class="btn-create" onclick={onopenCreatePanel}>
	<Icon name="plus" size={13} />
	<span class="btn-create-text">New</span>
	<kbd class="create-hotkey">N</kbd>
</button>

<style>
	.search-container {
		position: relative;
		display: flex;
		align-items: center;
		width: 180px;
	}

	.search-icon {
		position: absolute;
		left: 0.625rem;
		display: flex;
		color: var(--text-tertiary);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		height: 1.75rem;
		padding: 0 2.5rem 0 2rem;
		background: rgba(255, 255, 255, 0.04);
		border: none;
		border-radius: 0.25rem;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.75rem;
	}

	.search-input::placeholder {
		color: var(--text-tertiary);
	}

	.search-input:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.08);
	}

	:global(.app.light) .search-input {
		background: rgba(0, 0, 0, 0.03);
	}

	:global(.app.light) .search-input:focus {
		background: rgba(0, 0, 0, 0.05);
	}

	.search-clear {
		position: absolute;
		right: 0.375rem;
		width: 1rem;
		height: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 0.125rem;
		color: var(--text-tertiary);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.search-clear:hover {
		color: var(--text-primary);
	}

	.hotkey-hint {
		position: absolute;
		right: 0.375rem;
		font-family: ui-monospace, monospace;
		font-size: 0.625rem;
		color: var(--text-tertiary);
		opacity: 0.5;
	}

	.btn-create {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		height: 1.75rem;
		padding: 0 0.625rem;
		background: rgba(59, 130, 246, 0.12);
		border: none;
		border-radius: 0.25rem;
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		color: #60a5fa;
		cursor: pointer;
		transition: background 0.1s;
	}

	.btn-create:hover {
		background: rgba(59, 130, 246, 0.18);
	}

	:global(.app.light) .btn-create {
		background: rgba(59, 130, 246, 0.08);
		color: #2563eb;
	}

	:global(.app.light) .btn-create:hover {
		background: rgba(59, 130, 246, 0.12);
	}

	.btn-create-text {
		font-weight: 500;
	}

	.create-hotkey {
		font-family: ui-monospace, monospace;
		font-size: 0.5625rem;
		opacity: 0.5;
	}

	@media (max-width: 768px) {
		.search-container {
			width: 100px;
		}

		.search-input {
			height: 1.5rem;
			padding: 0 1.5rem 0 1.75rem;
		}

		.search-icon {
			left: 0.5rem;
		}

		.btn-create-text,
		.create-hotkey,
		.hotkey-hint {
			display: none;
		}

		.btn-create {
			padding: 0;
			width: 1.5rem;
			height: 1.5rem;
		}
	}
</style>
